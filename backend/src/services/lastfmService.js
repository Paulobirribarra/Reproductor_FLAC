import crypto from 'crypto';

const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';

export class LastFmService {
  /**
   * @param {import('./redisService.js').RedisService} redisService
   */
  constructor(redisService) {
    this.redisService = redisService;
    this.apiKey = process.env.LASTFM_API_KEY;
    this.apiSecret = process.env.LASTFM_API_SECRET;

    if (!this.apiKey || !this.apiSecret) {
      console.warn('[LastFmService] ⚠️ LASTFM_API_KEY o LASTFM_API_SECRET no están configuradas en las variables de entorno.');
    }
    
    // Respetar el prefijo de Redis configurado en la app (ej: "audio:")
    const appPrefix = process.env.REDIS_KEY_PREFIX || 'audio:';
    this.sessionRedisKey = `${appPrefix}lastfm:session`;
    console.log(`[LastFmService] Usando clave de sesión Redis: "${this.sessionRedisKey}"`);
  }

  /**
   * Genera la firma api_sig requerida por Last.fm para peticiones autenticadas
   * Regla: Ordenar claves alfabéticamente (excluyendo 'format' y 'callback'),
   * concatenar clave+valor en UTF-8, agregar secret y calcular MD5.
   */
  generateApiSig(params) {
    const keys = Object.keys(params)
      .filter((k) => k !== 'format' && k !== 'callback')
      .sort();

    let sigStr = '';
    for (const k of keys) {
      if (params[k] !== undefined && params[k] !== null) {
        sigStr += `${k}${params[k]}`;
      }
    }
    sigStr += this.apiSecret;

    return crypto.createHash('md5').update(sigStr, 'utf8').digest('hex');
  }

  /**
   * Realiza una petición POST a la API de Last.fm con formato JSON y firma api_sig
   */
  async requestSigned(params) {
    const payload = {
      ...params,
      api_key: this.apiKey,
    };

    const api_sig = this.generateApiSig(payload);
    payload.api_sig = api_sig;
    payload.format = 'json';

    const bodyParams = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      bodyParams.append(key, String(value));
    }

    const response = await fetch(LASTFM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Raspi_flac/1.0',
      },
      body: bodyParams.toString(),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      const errorMsg = data.message || `Last.fm error ${data.error || response.status}`;
      const err = new Error(errorMsg);
      err.code = data.error;
      throw err;
    }

    return data;
  }

  /**
   * Obtiene la sesión actual desde Redis
   */
  async getStoredSession() {
    try {
      if (!this.redisService?.isConnected()) {
        console.warn('[LastFmService] Redis no está conectado al consultar sesión');
        return null;
      }
      const data = await this.redisService.redis.get(this.sessionRedisKey);
      if (!data) return null;
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (err) {
      console.error('[LastFmService] Error al leer sesión de Redis:', err.message);
      return null;
    }
  }

  /**
   * Guarda o actualiza la sesión en Redis (permanente, sin TTL)
   */
  async saveSession(sessionData) {
    try {
      if (!this.redisService?.isConnected()) {
        console.warn('[LastFmService] Redis no está conectado al guardar sesión');
        return false;
      }
      await this.redisService.redis.set(
        this.sessionRedisKey,
        JSON.stringify(sessionData)
      );
      return true;
    } catch (err) {
      console.error('[LastFmService] Error al guardar sesión en Redis:', err.message);
      return false;
    }
  }

  /**
   * Retorna el estado actual de la conexión
   */
  async getStatus() {
    const session = await this.getStoredSession();
    if (!session || !session.sessionKey) {
      return {
        connected: false,
        username: null,
        scrobblingEnabled: false,
        apiKey: this.apiKey,
      };
    }

    return {
      connected: true,
      username: session.username,
      scrobblingEnabled: session.scrobblingEnabled !== false,
      apiKey: this.apiKey,
    };
  }

  /**
   * Intercambia un token web temporal de Last.fm por una session_key permanente (auth.getSession)
   */
  async authenticateWithToken(token) {
    if (!token) {
      throw new Error('Token de Last.fm no proporcionado');
    }

    console.log(`[LastFmService] Obteniendo sesión con token: ${token}`);
    const res = await this.requestSigned({
      method: 'auth.getSession',
      token: token,
    });

    if (!res.session || !res.session.key) {
      throw new Error('Respuesta inválida de Last.fm al obtener sesión');
    }

    const sessionData = {
      username: res.session.name,
      sessionKey: res.session.key,
      scrobblingEnabled: true,
      connectedAt: new Date().toISOString(),
    };

    await this.saveSession(sessionData);
    console.log(`[LastFmService] ✅ Autenticado exitosamente como @${sessionData.username}`);

    return {
      success: true,
      username: sessionData.username,
      scrobblingEnabled: sessionData.scrobblingEnabled,
    };
  }

  /**
   * Desconecta la cuenta y borra los datos de sesión
   */
  async disconnect() {
    try {
      if (this.redisService?.isConnected()) {
        await this.redisService.redis.del(this.sessionRedisKey);
      }
      return { success: true };
    } catch (err) {
      console.error('[LastFmService] Error desconectando:', err.message);
      throw err;
    }
  }

  /**
   * Activa o desactiva el scrobbling
   */
  async setScrobblingEnabled(enabled) {
    const session = await this.getStoredSession();
    if (!session) {
      throw new Error('No hay sesión de Last.fm activa');
    }

    session.scrobblingEnabled = Boolean(enabled);
    await this.saveSession(session);

    return {
      success: true,
      scrobblingEnabled: session.scrobblingEnabled,
    };
  }

  /**
   * Notifica a Last.fm la pista que se está reproduciendo actualmente (track.updateNowPlaying)
   */
  async updateNowPlaying({ artist, track, album, duration }) {
    const session = await this.getStoredSession();
    if (!session || !session.sessionKey || session.scrobblingEnabled === false) {
      return { skipped: true, reason: 'No session or scrobbling disabled' };
    }

    if (!artist || !track) {
      throw new Error('Se requiere artist y track para updateNowPlaying');
    }

    const params = {
      method: 'track.updateNowPlaying',
      sk: session.sessionKey,
      artist: artist.trim(),
      track: track.trim(),
    };

    if (album && album.trim()) {
      params.album = album.trim();
    }
    if (duration && Number(duration) > 0) {
      params.duration = Math.round(Number(duration));
    }

    console.log(`[LastFmService] 🎵 Now Playing: "${track}" - ${artist}`);
    const res = await this.requestSigned(params);
    return { success: true, result: res };
  }

  /**
   * Envía el scrobble final a Last.fm (track.scrobble)
   */
  async scrobble({ artist, track, album, timestamp }) {
    const session = await this.getStoredSession();
    if (!session || !session.sessionKey || session.scrobblingEnabled === false) {
      return { skipped: true, reason: 'No session or scrobbling disabled' };
    }

    if (!artist || !track || !timestamp) {
      throw new Error('Se requiere artist, track y timestamp para scrobble');
    }

    const params = {
      method: 'track.scrobble',
      sk: session.sessionKey,
      artist: artist.trim(),
      track: track.trim(),
      timestamp: Math.round(Number(timestamp)),
    };

    if (album && album.trim()) {
      params.album = album.trim();
    }

    console.log(`[LastFmService] 🎧 Scrobbled: "${track}" - ${artist} (ts: ${params.timestamp})`);
    const res = await this.requestSigned(params);
    return { success: true, result: res };
  }
}

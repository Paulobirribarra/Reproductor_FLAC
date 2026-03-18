import Redis from 'ioredis';

export class RedisService {
  constructor(redisUrl = null) {
    this.redisUrl = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379/0';
    this.redis = null;
    this.connected = false;
    this.maxCacheSize = parseInt(process.env.REDIS_MAX_CACHE_SIZE || '1073741824', 10); // 1 GB por defecto

    // Usar prefijo desde .env (default: 'audio:')
    const appPrefix = process.env.REDIS_KEY_PREFIX || 'audio:';
    this.cachePrefix = appPrefix + 'preload:';
    this.cacheSizeKey = appPrefix + 'size';

    this.cacheTTL = parseInt(process.env.REDIS_CACHE_TTL || '86400', 10); // 24 horas por defecto

    // Log del prefijo para debugging
    const appName = process.env.APP_NAME || 'app';
    console.log(`[Redis] Inicializando: ${appName} con prefijo "${appPrefix}"`);
  }

  async connect() {
    try {
      this.redis = new Redis(this.redisUrl, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: null,
      });

      this.redis.on('connect', () => {
        console.log('[Redis] Conectado exitosamente');
        this.connected = true;
      });

      this.redis.on('error', (err) => {
        console.error('[Redis] Error de conexión:', err.message);
        this.connected = false;
      });

      // Esperar a que se conecte
      await new Promise((resolve, reject) => {
        this.redis.once('connect', resolve);
        this.redis.once('error', reject);
        setTimeout(() => reject(new Error('Redis connection timeout')), 10000);
      });

      return this.connected;
    } catch (error) {
      console.error('[Redis] Error al conectar:', error.message);
      this.connected = false;
      throw error;
    }
  }

  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
      this.connected = false;
      console.log('[Redis] Desconectado');
    }
  }

  isConnected() {
    return this.connected && this.redis !== null;
  }

  /**
   * Guardar metadatos de precarga (NO el archivo)
   * Solo archivos pequeños (<1MB) se almacenan completos
   * Archivos grandes: solo guardar ruta y metadata
   * @param {string} cacheKey - Identificador único del archivo
   * @param {Object} metadata - { path, size, timestamp, type }
   * @param {Buffer} buffer - Contenido (solo para archivos <1MB)
   * @returns {Promise<{success: boolean, stored: string}>}
   */
  async saveToCache(cacheKey, metadata, buffer = null) {
    try {
      if (!this.isConnected()) {
        throw new Error('Redis no está conectado');
      }

      const SMALL_FILE_THRESHOLD = 1048576; // 1MB en bytes
      let storageType = 'metadata'; // Por defecto: solo metadatos
      let bufferSize = 0;

      // Solo guardar archivo si es pequeño (<1MB) y buffer existe
      if (buffer && buffer.length <= SMALL_FILE_THRESHOLD) {
        bufferSize = buffer.length;
        storageType = 'content'; // Guardar contenido también
      } else if (buffer && buffer.length > SMALL_FILE_THRESHOLD) {
        console.log(`[Redis] Archivo rechazado: ${(buffer.length / 1024 / 1024).toFixed(2)}MB excede 1MB. Solo guardando metadatos.`);
      }

      const fullKey = this.cachePrefix + cacheKey;

      // Guardar metadatos en JSON
      const cacheEntry = {
        ...metadata,
        storageType,
        bufferSize,
        timestamp: Date.now(),
      };

      // Si es pequeño, guardar con contenido; si es grande, solo metadatos
      if (storageType === 'content' && buffer) {
        // Para archivos pequeños: guardar metadata + contenido
        await this.redis.setex(
          fullKey,
          this.cacheTTL,
          JSON.stringify({
            ...cacheEntry,
            _hasContent: true,
          })
        );

        // Guardar contenido en clave separada
        const contentKey = fullKey + ':content';
        await this.redis.setex(contentKey, this.cacheTTL, buffer);

        console.log(
          `[Redis] Archivo pequeño guardado: ${cacheKey} (${(bufferSize / 1024 / 1024).toFixed(2)}MB) con contenido en caché`
        );
      } else {
        // Para archivos grandes: solo metadatos, sin contenido en Redis
        await this.redis.setex(
          fullKey,
          this.cacheTTL,
          JSON.stringify(cacheEntry)
        );

        console.log(
          `[Redis] Metadatos guardados: ${cacheKey} (${(metadata.size / 1024 / 1024).toFixed(2)}MB) - streaming desde NVMe`
        );
      }

      return {
        success: true,
        size: bufferSize,
        storageType,
      };
    } catch (error) {
      console.error('[Redis] Error guardando caché:', error.message);
      throw error;
    }
  }

  /**
   * Obtener archivo del caché
   * @param {string} cacheKey - Identificador único del archivo
   * @returns {Promise<{metadata: object, content: Buffer|null}>}
   */
  async getFromCache(cacheKey) {
    try {
      if (!this.isConnected()) {
        return null;
      }

      const fullKey = this.cachePrefix + cacheKey;
      const metadataStr = await this.redis.get(fullKey);

      if (!metadataStr) {
        console.log(`[Redis] Cache miss: ${cacheKey}`);
        return null;
      }

      const metadata = JSON.parse(metadataStr);
      console.log(`[Redis] Cache hit: ${cacheKey}`);

      // Renovar TTL
      await this.redis.expire(fullKey, this.cacheTTL);

      // Si hay contenido almacenado, obtenerlo también
      let content = null;
      if (metadata._hasContent) {
        const contentKey = fullKey + ':content';
        content = await this.redis.getBuffer(contentKey);
        await this.redis.expire(contentKey, this.cacheTTL);
      }

      return { metadata, content };
    } catch (error) {
      console.error('[Redis] Error obteniendo caché:', error.message);
      return null;
    }
  }

  /**
   * Verificar si existe en caché
   * @param {string} cacheKey - Identificador único del archivo
   * @returns {Promise<boolean>}
   */
  async existsInCache(cacheKey) {
    try {
      if (!this.isConnected()) {
        return false;
      }

      const fullKey = this.cachePrefix + cacheKey;
      const exists = await this.redis.exists(fullKey);
      return exists === 1;
    } catch (error) {
      console.error('[Redis] Error verificando caché:', error.message);
      return false;
    }
  }

  /**
   * Eliminar archivo del caché
   * @param {string} cacheKey - Identificador único del archivo
   * @returns {Promise<boolean>}
   */
  async deleteFromCache(cacheKey) {
    try {
      if (!this.isConnected()) {
        return false;
      }

      const fullKey = this.cachePrefix + cacheKey;

      // Obtener metadata para verificar si existe
      const metadataStr = await this.redis.get(fullKey);

      if (metadataStr) {
        const metadata = JSON.parse(metadataStr);

        // Eliminar metadatos
        await this.redis.del(fullKey);

        // Eliminar contenido si existe
        if (metadata._hasContent) {
          await this.redis.del(fullKey + ':content');
        }

        console.log(`[Redis] Archivo eliminado: ${cacheKey}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[Redis] Error eliminando caché:', error.message);
      return false;
    }
  }

  /**
   * Limpiar todo el caché
   * @returns {Promise<boolean>}
   */
  async clearCache() {
    try {
      if (!this.isConnected()) {
        return false;
      }

      // Buscar todas las claves de caché (metadata + content)
      const keys = await this.redis.keys(this.cachePrefix + '*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      console.log(`[Redis] Caché limpiado (${keys.length} claves eliminadas)`);
      return true;
    } catch (error) {
      console.error('[Redis] Error limpiando caché:', error.message);
      return false;
    }
  }

  /**
   * Obtener tamaño total del caché en bytes
   * @returns {Promise<number>}
   */
  async getCacheSizeBytes() {
    try {
      if (!this.isConnected()) {
        return 0;
      }

      const size = await this.redis.get(this.cacheSizeKey);
      return size ? parseInt(size, 10) : 0;
    } catch (error) {
      console.error('[Redis] Error obteniendo tamaño de caché:', error.message);
      return 0;
    }
  }

  /**
   * Obtener estadísticas del caché
   * @returns {Promise<object>}
   */
  async getCacheStats() {
    try {
      if (!this.isConnected()) {
        return null;
      }

      const keys = await this.redis.keys(this.cachePrefix + '*');
      const size = await this.getCacheSizeBytes();

      return {
        itemCount: keys.length,
        sizeBytes: size,
        sizeMB: (size / 1024 / 1024).toFixed(2),
        maxSizeMB: (this.maxCacheSize / 1024 / 1024).toFixed(2),
        ttlSeconds: this.cacheTTL,
        connected: this.connected,
      };
    } catch (error) {
      console.error('[Redis] Error obteniendo estadísticas:', error.message);
      return null;
    }
  }
}

// Singleton
let redisInstance = null;

export const getRedisService = () => {
  if (!redisInstance) {
    redisInstance = new RedisService();
  }
  return redisInstance;
};

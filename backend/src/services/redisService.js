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
   * Guardar archivo en caché
   * @param {string} cacheKey - Identificador único del archivo
   * @param {Buffer} buffer - Contenido del archivo
   * @returns {Promise<{success: boolean, size: number}>}
   */
  async saveToCache(cacheKey, buffer) {
    try {
      if (!this.isConnected()) {
        throw new Error('Redis no está conectado');
      }

      const bufferSize = buffer.length;
      const currentSize = await this.getCacheSizeBytes();

      // Verificar límite de tamaño
      if (currentSize + bufferSize > this.maxCacheSize) {
        console.warn(
          `[Redis] Límite de caché alcanzado: ${(currentSize / 1024 / 1024).toFixed(2)}MB + ${(bufferSize / 1024 / 1024).toFixed(2)}MB > ${(this.maxCacheSize / 1024 / 1024).toFixed(2)}MB`
        );
        throw new Error('Cache size limit exceeded');
      }

      // Guardar con TTL
      const fullKey = this.cachePrefix + cacheKey;
      await this.redis.setex(fullKey, this.cacheTTL, buffer);

      // Actualizar tamaño
      const newSize = currentSize + bufferSize;
      await this.redis.set(this.cacheSizeKey, newSize);

      console.log(
        `[Redis] Archivo guardado: ${cacheKey} (${(bufferSize / 1024 / 1024).toFixed(2)}MB). Caché total: ${(newSize / 1024 / 1024).toFixed(2)}MB`
      );

      return {
        success: true,
        size: bufferSize,
        totalCacheSize: newSize,
      };
    } catch (error) {
      console.error('[Redis] Error guardando caché:', error.message);
      throw error;
    }
  }

  /**
   * Obtener archivo del caché
   * @param {string} cacheKey - Identificador único del archivo
   * @returns {Promise<Buffer|null>}
   */
  async getFromCache(cacheKey) {
    try {
      if (!this.isConnected()) {
        return null;
      }

      const fullKey = this.cachePrefix + cacheKey;
      const buffer = await this.redis.getBuffer(fullKey);

      if (buffer) {
        console.log(`[Redis] Cache hit: ${cacheKey}`);
        // Renovar TTL
        await this.redis.expire(fullKey, this.cacheTTL);
      } else {
        console.log(`[Redis] Cache miss: ${cacheKey}`);
      }

      return buffer;
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
      const buffer = await this.redis.getBuffer(fullKey);
      const deleted = await this.redis.del(fullKey);

      if (deleted > 0 && buffer) {
        // Actualizar tamaño
        const currentSize = await this.getCacheSizeBytes();
        const newSize = Math.max(0, currentSize - buffer.length);
        await this.redis.set(this.cacheSizeKey, newSize);

        console.log(
          `[Redis] Archivo eliminado: ${cacheKey}. Caché total: ${(newSize / 1024 / 1024).toFixed(2)}MB`
        );
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

      // Buscar todas las claves de caché
      const keys = await this.redis.keys(this.cachePrefix + '*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      // Resetear tamaño
      await this.redis.set(this.cacheSizeKey, 0);

      console.log(`[Redis] Caché limpiado (${keys.length} archivos eliminados)`);
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

import { Router } from 'express';
import { getRedisService } from '../services/redisService.js';

export function createPreloadRoutes() {
  const router = Router();
  const redisService = getRedisService();

  /**
   * GET /api/preload/cache/:cacheKey
   * Obtener archivo del caché Redis
   */
  router.get('/cache/:cacheKey', async (req, res) => {
    try {
      const { cacheKey } = req.params;

      if (!cacheKey) {
        return res.status(400).json({ success: false, error: 'Cache key required' });
      }

      const buffer = await redisService.getFromCache(cacheKey);

      if (!buffer) {
        return res.status(404).json({ success: false, error: 'Not found in cache' });
      }

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(buffer);
    } catch (error) {
      console.error('[Preload] Error obteniendo caché:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/preload/cache
   * Guardar archivo en caché Redis
   * Body: { cacheKey: string, buffer: Buffer }
   */
  router.post('/cache', async (req, res) => {
    try {
      const { cacheKey } = req.body;
      const buffer = req.body.buffer;

      if (!cacheKey || !buffer) {
        return res.status(400).json({ success: false, error: 'Cache key and buffer required' });
      }

      // Convertir base64 a Buffer si es necesario
      let bufferToSave = buffer;
      if (typeof buffer === 'string') {
        bufferToSave = Buffer.from(buffer, 'base64');
      }

      const result = await redisService.saveToCache(cacheKey, bufferToSave);

      res.status(200).json({
        success: true,
        message: 'Archivo guardado en caché',
        ...result,
      });
    } catch (error) {
      console.error('[Preload] Error guardando caché:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/preload/cache/binary
   * Guardar archivo grande en caché Redis (sin base64, streaming binario)
   * Content-Type: application/octet-stream
   * Query: ?cacheKey=archivo.flac
   */
  router.post('/cache/binary', async (req, res) => {
    try {
      const { cacheKey } = req.query;

      if (!cacheKey) {
        return res.status(400).json({ success: false, error: 'Cache key required in query' });
      }

      // El body es el buffer binario directo
      let bufferToSave;
      
      if (Buffer.isBuffer(req.body)) {
        bufferToSave = req.body;
      } else if (typeof req.body === 'string') {
        // Fallback si llega como string (no debería pasar)
        bufferToSave = Buffer.from(req.body);
      } else {
        return res.status(400).json({ success: false, error: 'Invalid binary data' });
      }

      console.log(`[Preload] Guardando binario: ${cacheKey} (${(bufferToSave.length / 1024 / 1024).toFixed(2)} MB)`);

      const result = await redisService.saveToCache(cacheKey, bufferToSave);

      res.status(200).json({
        success: true,
        message: 'Archivo binario guardado en caché',
        ...result,
      });
    } catch (error) {
      console.error('[Preload] Error guardando caché binario:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/preload/cache/:cacheKey
   * Eliminar archivo del caché Redis
   */
  router.delete('/cache/:cacheKey', async (req, res) => {
    try {
      const { cacheKey } = req.params;

      if (!cacheKey) {
        return res.status(400).json({ success: false, error: 'Cache key required' });
      }

      const deleted = await redisService.deleteFromCache(cacheKey);

      res.status(200).json({
        success: deleted,
        message: deleted ? 'Archivo eliminado del caché' : 'No encontrado en caché',
      });
    } catch (error) {
      console.error('[Preload] Error eliminando caché:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/preload/cache
   * Limpiar todo el caché Redis
   */
  router.delete('/cache', async (req, res) => {
    try {
      const cleared = await redisService.clearCache();

      res.status(200).json({
        success: cleared,
        message: cleared ? 'Caché limpiado completamente' : 'Error limpiando caché',
      });
    } catch (error) {
      console.error('[Preload] Error limpiando caché:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/preload/cache/:cacheKey/exists
   * Verificar si archivo existe en caché
   */
  router.get('/cache/:cacheKey/exists', async (req, res) => {
    try {
      const { cacheKey } = req.params;

      if (!cacheKey) {
        return res.status(400).json({ success: false, error: 'Cache key required' });
      }

      const exists = await redisService.existsInCache(cacheKey);

      res.status(200).json({
        success: true,
        exists,
      });
    } catch (error) {
      console.error('[Preload] Error verificando caché:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/preload/stats
   * Obtener estadísticas del caché Redis
   */
  router.get('/stats', async (req, res) => {
    try {
      const stats = await redisService.getCacheStats();

      if (!stats) {
        return res.status(503).json({
          success: false,
          error: 'Redis no está disponible',
          connected: redisService.isConnected(),
        });
      }

      res.status(200).json({
        success: true,
        ...stats,
      });
    } catch (error) {
      console.error('[Preload] Error obteniendo estadísticas:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

import { Router } from 'express';
import { getRedisService } from '../services/redisService.js';

export function createPreloadRoutes() {
  const router = Router();
  const redisService = getRedisService();

  /**
   * GET /api/preload/cache/:cacheKey
   * Obtener contenido del caché Redis (si existe)
   * Para archivos pequeños (<1MB) devuelve el contenido
   * Para archivos grandes devuelve metadatos con ruta para streaming
   */
  router.get('/cache/:cacheKey', async (req, res) => {
    try {
      const { cacheKey } = req.params;

      if (!cacheKey) {
        return res.status(400).json({ success: false, error: 'Cache key required' });
      }

      const result = await redisService.getFromCache(cacheKey);

      if (!result) {
        return res.status(404).json({ success: false, error: 'Not found in cache' });
      }

      const { metadata, content } = result;

      // Si hay contenido (archivo pequeño), devolverlo como binary
      if (content) {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Storage-Type', 'content');
        res.send(content);
      } else {
        // Solo metadatos: cliente debe hacer streaming desde NVMe
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Storage-Type', 'metadata');
        res.json({
          success: true,
          metadata,
          message: 'Archivo grande: usar streaming desde ruta',
        });
      }
    } catch (error) {
      console.error('[Preload] Error obteniendo caché:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/preload/cache
   * Guardar archivo pequeño en caché (<1MB)
   * Rechazar archivos grandes (>1MB)
   */
  router.post('/cache', async (req, res) => {
    try {
      const { cacheKey, buffer, metadata } = req.body;

      if (!cacheKey || !metadata) {
        return res.status(400).json({ success: false, error: 'Cache key and metadata required' });
      }

      // Convertir base64 a Buffer si existe
      let bufferToSave = null;
      if (buffer && typeof buffer === 'string') {
        bufferToSave = Buffer.from(buffer, 'base64');
      } else if (Buffer.isBuffer(buffer)) {
        bufferToSave = buffer;
      }

      const result = await redisService.saveToCache(cacheKey, metadata, bufferToSave);

      res.status(200).json({
        success: true,
        message: 'Precarga procesada',
        ...result,
      });
    } catch (error) {
      console.error('[Preload] Error guardando caché:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/preload/cache/burst
   * Guardar metadata + pequeño burst (5MB) del archivo
   * Usado para archivos grandes en estrategia "burst preload"
   */
  router.post('/cache/burst', async (req, res) => {
    try {
      const { cacheKey, metadata } = req.body;
      let bufferBurst = req.body.burst;

      if (!cacheKey || !metadata) {
        return res.status(400).json({ success: false, error: 'Cache key and metadata required' });
      }

      // Convertir burst a Buffer si es necesario
      if (bufferBurst && typeof bufferBurst === 'string') {
        bufferBurst = Buffer.from(bufferBurst, 'base64');
      } else if (Buffer.isBuffer(bufferBurst)) {
        // Ya es buffer
      } else {
        bufferBurst = null;
      }

      const result = await redisService.saveToCache(cacheKey, metadata, bufferBurst);

      res.status(200).json({
        success: true,
        message: 'Burst preload guardado',
        ...result,
      });
    } catch (error) {
      console.error('[Preload] Error guardando burst:', error.message);
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

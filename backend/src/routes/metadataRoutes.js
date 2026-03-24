import express from 'express';

export function createMetadataRoutes(metadataService, redisService) {
    const router = express.Router();

    /**
     * GET /api/metadata/:filePath
     * Obtiene metadatos de un archivo específico
     * Cachea en Redis con prefijo "metadata:"
     */
    router.get('/:filePath', async (req, res) => {
        try {
            const { filePath } = req.params;
            const decodedPath = decodeURIComponent(filePath);

            // Intentar obtener del caché Redis
            let metadata = null;
            const cacheKey = `metadata:${decodedPath}`;

            if (redisService?.isConnected()) {
                try {
                    const cached = await redisService.redis.get(cacheKey);
                    if (cached) {
                        console.log(`[MetadataAPI] Cache hit: ${decodedPath}`);
                        metadata = JSON.parse(cached);
                        return res.json({ success: true, data: metadata, cached: true });
                    }
                } catch (cacheErr) {
                    console.warn('[MetadataAPI] Cache error:', cacheErr.message);
                }
            }

            // Extraer metadatos
            metadata = await metadataService.getMetadata(decodedPath);

            // Guardar en Redis (opcional, TTL 1h)
            if (redisService?.isConnected()) {
                try {
                    await redisService.redis.setex(cacheKey, 3600, JSON.stringify(metadata));
                    console.log(`[MetadataAPI] Metadata cacheado: ${decodedPath}`);
                } catch (cacheErr) {
                    console.warn('[MetadataAPI] Error cacheando:', cacheErr.message);
                }
            }

            res.json({ success: true, data: metadata, cached: false });
        } catch (error) {
            console.error('[MetadataAPI] Error:', error.message);
            res.status(400).json({ success: false, error: error.message });
        }
    });

    /**
     * DELETE /api/metadata/:filePath
     * Limpia el caché de metadatos
     */
    router.delete('/:filePath', async (req, res) => {
        try {
            const { filePath } = req.params;
            const decodedPath = decodeURIComponent(filePath);
            const cacheKey = `metadata:${decodedPath}`;

            if (redisService?.isConnected()) {
                await redisService.redis.del(cacheKey);
                console.log(`[MetadataAPI] Metadata cache limpiado: ${decodedPath}`);
            }

            res.json({ success: true, message: 'Metadata cache cleared' });
        } catch (error) {
            console.error('[MetadataAPI] Error:', error.message);
            res.status(400).json({ success: false, error: error.message });
        }
    });

    /**
     * GET /api/metadata/batch
     * Obtiene metadatos de múltiples archivos
     * Útil para cargar metadatos de varios tracks
     */
    router.post('/batch', async (req, res) => {
        try {
            const { files } = req.body;

            if (!Array.isArray(files)) {
                return res.status(400).json({ success: false, error: 'files debe ser un array' });
            }

            const results = [];

            for (const filePath of files) {
                try {
                    const decodedPath = decodeURIComponent(filePath);
                    const cacheKey = `metadata:${decodedPath}`;

                    let metadata = null;

                    // Intentar caché
                    if (redisService?.isConnected()) {
                        try {
                            const cached = await redisService.redis.get(cacheKey);
                            if (cached) {
                                metadata = JSON.parse(cached);
                            }
                        } catch (e) {
                            // Silenciosamente ignorar error de caché
                        }
                    }

                    // Si no está en caché, extraer
                    if (!metadata) {
                        metadata = await metadataService.getMetadata(decodedPath);

                        // Guardar en caché
                        if (redisService?.isConnected()) {
                            try {
                                await redisService.redis.setex(cacheKey, 3600, JSON.stringify(metadata));
                            } catch (e) {
                                // Silenciosamente ignorar error de caché
                            }
                        }
                    }

                    results.push(metadata);
                } catch (error) {
                    results.push({ path: filePath, error: error.message });
                }
            }

            res.json({ success: true, data: results });
        } catch (error) {
            console.error('[MetadataAPI] Batch error:', error.message);
            res.status(400).json({ success: false, error: error.message });
        }
    });

    return router;
}

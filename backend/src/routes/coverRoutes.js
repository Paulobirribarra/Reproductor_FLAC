import express from 'express';

export function createCoverRoutes(coverService) {
  const router = express.Router();

  /**
   * GET /api/covers/:folderPath(*)
   * Devuelve la carátula optimizada WebP (~2-5 KB)
   * Headers agresivos de caché para evitar consumo en redes celulares
   */
  router.get('/*', async (req, res) => {
    try {
      // req.params[0] captura la ruta completa de la subcarpeta (ej: 'No-Man/2005 - Returning Jesus Demos')
      const rawPath = req.params[0] || '';
      const folderPath = decodeURIComponent(rawPath);

      if (!folderPath) {
        return res.status(400).json({ success: false, error: 'Ruta no especificada' });
      }

      const cover = await coverService.getCover(folderPath);

      if (!cover || !cover.path) {
        // Enviar SVG placeholder ligero (200 OK con caché larga) para evitar errores 404 en la consola
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        const placeholderSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150" width="150" height="150">
            <rect width="150" height="150" fill="#18181b"/>
            <circle cx="75" cy="75" r="45" fill="#27272a" stroke="#3f3f46" stroke-width="2"/>
            <circle cx="75" cy="75" r="15" fill="#18181b" stroke="#52525b" stroke-width="2"/>
            <circle cx="75" cy="75" r="4" fill="#71717a"/>
          </svg>
        `.trim();
        return res.send(placeholderSvg);
      }

      // Headers de caché optimizados para redes móviles (Tailscale / 5G)
      // Cache-Control: 1 año, inmutable. El navegador la guardará en disco local y no volverá a pedirla.
      res.setHeader('Content-Type', cover.mimeType || 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      res.sendFile(cover.path);
    } catch (error) {
      console.error('[CoverRoutes] Error sirviendo carátula:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

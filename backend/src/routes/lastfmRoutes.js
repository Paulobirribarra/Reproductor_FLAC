import express from 'express';

export function createLastFmRoutes(lastFmService) {
  const router = express.Router();

  // GET /api/lastfm/status
  router.get('/status', async (req, res, next) => {
    try {
      const status = await lastFmService.getStatus();
      res.json({ success: true, ...status });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/lastfm/session (intercambia token por sesión permanente)
  router.post('/session', async (req, res, next) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, error: 'Token es requerido' });
      }
      const session = await lastFmService.authenticateWithToken(token);
      res.json({ success: true, ...session });
    } catch (err) {
      console.error('[LastFmRoutes] Error en /session:', err.message);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/lastfm/disconnect
  router.post('/disconnect', async (req, res, next) => {
    try {
      await lastFmService.disconnect();
      res.json({ success: true, message: 'Sesión de Last.fm eliminada' });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/lastfm/toggle-scrobble
  router.post('/toggle-scrobble', async (req, res, next) => {
    try {
      const { enabled } = req.body;
      const result = await lastFmService.setScrobblingEnabled(enabled);
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/lastfm/now-playing
  router.post('/now-playing', async (req, res, next) => {
    try {
      const { artist, track, album, duration } = req.body;
      const result = await lastFmService.updateNowPlaying({ artist, track, album, duration });
      res.json(result);
    } catch (err) {
      console.warn('[LastFmRoutes] Error en now-playing:', err.message);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/lastfm/scrobble
  router.post('/scrobble', async (req, res, next) => {
    try {
      const { artist, track, album, timestamp } = req.body;
      const result = await lastFmService.scrobble({ artist, track, album, timestamp });
      res.json(result);
    } catch (err) {
      console.warn('[LastFmRoutes] Error en scrobble:', err.message);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  return router;
}

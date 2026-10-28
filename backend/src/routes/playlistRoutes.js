import express from 'express';

export function createPlaylistRoutes(playlistService) {
  const router = express.Router();

  // Obtener todas las listas
  router.get('/', async (req, res) => {
    try {
      const playlists = await playlistService.getAllPlaylists();
      res.json({ success: true, data: playlists });
    } catch (error) {
      console.error('Error fetching playlists:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Obtener una lista por ID
  router.get('/:id', async (req, res) => {
    try {
      const playlist = await playlistService.getPlaylistById(req.params.id);
      if (!playlist) {
        return res.status(404).json({ success: false, error: 'Lista no encontrada' });
      }
      res.json({ success: true, data: playlist });
    } catch (error) {
      console.error('Error fetching playlist:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Crear una lista
  router.post('/', async (req, res) => {
    try {
      const { name, description } = req.body;
      const playlist = await playlistService.createPlaylist(name, description);
      res.status(201).json({ success: true, data: playlist });
    } catch (error) {
      console.error('Error creating playlist:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Modificar una lista (nombre, descripción, o reordenar tracks)
  router.put('/:id', async (req, res) => {
    try {
      const playlist = await playlistService.updatePlaylist(req.params.id, req.body);
      res.json({ success: true, data: playlist });
    } catch (error) {
      console.error('Error updating playlist:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Eliminar una lista
  router.delete('/:id', async (req, res) => {
    try {
      await playlistService.deletePlaylist(req.params.id);
      res.json({ success: true, message: 'Lista eliminada con éxito' });
    } catch (error) {
      console.error('Error deleting playlist:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Agregar track(s) a una lista
  router.post('/:id/tracks', async (req, res) => {
    try {
      const { tracks, track } = req.body;
      const tracksToAdd = tracks || (track ? [track] : []);
      if (tracksToAdd.length === 0) {
        return res.status(400).json({ success: false, error: 'No se especificaron tracks' });
      }
      const playlist = await playlistService.addTracksToPlaylist(req.params.id, tracksToAdd);
      res.json({ success: true, data: playlist });
    } catch (error) {
      console.error('Error adding tracks to playlist:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Eliminar un track de una lista
  router.delete('/:id/tracks/:trackId', async (req, res) => {
    try {
      const playlist = await playlistService.removeTrackFromPlaylist(req.params.id, req.params.trackId);
      res.json({ success: true, data: playlist });
    } catch (error) {
      console.error('Error removing track from playlist:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  return router;
}

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class PlaylistService {
  constructor(storageDir) {
    this.storageDir = storageDir;
    this.playlistFile = path.join(storageDir, 'playlists.json');
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      if (!fs.existsSync(this.playlistFile)) {
        fs.writeFileSync(this.playlistFile, JSON.stringify([], null, 2), 'utf-8');
      }
    } catch (err) {
      console.error('[PlaylistService] Error initializing playlists storage:', err);
    }
  }

  async _readPlaylists() {
    try {
      if (!fs.existsSync(this.playlistFile)) {
        return [];
      }
      const data = await fs.promises.readFile(this.playlistFile, 'utf-8');
      return JSON.parse(data || '[]');
    } catch (err) {
      console.error('[PlaylistService] Error reading playlists:', err);
      return [];
    }
  }

  async _writePlaylists(playlists) {
    await fs.promises.writeFile(this.playlistFile, JSON.stringify(playlists, null, 2), 'utf-8');
  }

  async getAllPlaylists() {
    return await this._readPlaylists();
  }

  async getPlaylistById(id) {
    const playlists = await this._readPlaylists();
    return playlists.find(p => p.id === id) || null;
  }

  async createPlaylist(name, description = '') {
    if (!name || !name.trim()) {
      throw new Error('El nombre de la lista es requerido');
    }

    const playlists = await this._readPlaylists();
    const newPlaylist = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description ? description.trim() : '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tracks: []
    };

    playlists.push(newPlaylist);
    await this._writePlaylists(playlists);
    return newPlaylist;
  }

  async updatePlaylist(id, updates) {
    const playlists = await this._readPlaylists();
    const index = playlists.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Lista de reproducción no encontrada');
    }

    const playlist = playlists[index];
    if (updates.name !== undefined) {
      playlist.name = updates.name.trim();
    }
    if (updates.description !== undefined) {
      playlist.description = updates.description.trim();
    }
    if (Array.isArray(updates.tracks)) {
      playlist.tracks = updates.tracks;
    }
    playlist.updatedAt = new Date().toISOString();

    playlists[index] = playlist;
    await this._writePlaylists(playlists);
    return playlist;
  }

  async deletePlaylist(id) {
    const playlists = await this._readPlaylists();
    const filtered = playlists.filter(p => p.id !== id);
    if (filtered.length === playlists.length) {
      throw new Error('Lista de reproducción no encontrada');
    }
    await this._writePlaylists(filtered);
    return true;
  }

  async addTracksToPlaylist(id, newTracks) {
    const playlists = await this._readPlaylists();
    const index = playlists.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Lista de reproducción no encontrada');
    }

    const playlist = playlists[index];
    const tracksToAdd = Array.isArray(newTracks) ? newTracks : [newTracks];

    for (const track of tracksToAdd) {
      // Evitar duplicados exactos si se desea o asignar id único para la entrada en la lista
      playlist.tracks.push({
        id: track.id || crypto.randomUUID(),
        name: track.name,
        path: track.path || track.name,
        size: track.size || 0,
        folder: track.folder || '',
        addedAt: new Date().toISOString()
      });
    }

    playlist.updatedAt = new Date().toISOString();
    playlists[index] = playlist;
    await this._writePlaylists(playlists);
    return playlist;
  }

  async removeTrackFromPlaylist(id, trackIdOrIndex) {
    const playlists = await this._readPlaylists();
    const index = playlists.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Lista de reproducción no encontrada');
    }

    const playlist = playlists[index];
    // Soporta eliminar por track.id o por índice numérico
    if (typeof trackIdOrIndex === 'number' || !isNaN(Number(trackIdOrIndex))) {
      const idx = Number(trackIdOrIndex);
      if (idx >= 0 && idx < playlist.tracks.length) {
        playlist.tracks.splice(idx, 1);
      }
    } else {
      playlist.tracks = playlist.tracks.filter(t => t.id !== trackIdOrIndex);
    }

    playlist.updatedAt = new Date().toISOString();
    playlists[index] = playlist;
    await this._writePlaylists(playlists);
    return playlist;
  }
}

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { playlistApi } from '../../services/api';
import type { Playlist, FileInfo } from '../../types/index';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileInfo | null;
  currentFolder?: string;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  file,
  currentFolder = ''
}) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPlaylists();
      setIsCreating(false);
      setNewPlaylistName('');
    }
  }, [isOpen]);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const res = await playlistApi.getAll();
      if (res.data.success && res.data.data) {
        setPlaylists(res.data.data);
      }
    } catch (err: any) {
      console.error('Error cargando listas:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !file) return null;

  const handleAddToPlaylist = async (playlist: Playlist) => {
    try {
      const trackPayload = {
        name: file.name,
        path: file.path || file.name,
        size: file.size,
        folder: currentFolder
      };

      const res = await playlistApi.addTracks(playlist.id, [trackPayload]);
      if (res.data.success) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `Añadido a "${playlist.name}"`,
          showConfirmButton: false,
          timer: 2000
        });
        onClose();
      }
    } catch (err: any) {
      Swal.fire('Error', err.response?.data?.error || 'No se pudo agregar a la lista', 'error');
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    try {
      const res = await playlistApi.create(newPlaylistName.trim());
      if (res.data.success && res.data.data) {
        const created = res.data.data;
        await handleAddToPlaylist(created);
      }
    } catch (err: any) {
      Swal.fire('Error', err.response?.data?.error || 'No se pudo crear la lista', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Añadir a Lista de Reproducción</h3>
            <p className="text-xs text-zinc-400 truncate max-w-xs mt-0.5" title={file.name}>
              🎵 {file.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="p-4 flex-1 max-h-80 overflow-y-auto space-y-2">
          {loading ? (
            <p className="text-center text-zinc-500 py-6 text-sm">Cargando listas...</p>
          ) : playlists.length === 0 && !isCreating ? (
            <div className="text-center py-6">
              <p className="text-zinc-400 text-sm mb-3">No tienes listas creadas aún.</p>
              <button
                onClick={() => setIsCreating(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
              >
                ➕ Crear primera lista
              </button>
            </div>
          ) : (
            <>
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => handleAddToPlaylist(pl)}
                  className="w-full text-left p-3 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between group transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white group-hover:text-blue-400 truncate">
                      {pl.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {pl.tracks.length} canciones
                    </p>
                  </div>
                  <span className="text-zinc-500 group-hover:text-blue-400 text-sm">➕</span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Formulario creación rápida */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/40">
          {isCreating ? (
            <form onSubmit={handleCreateAndAdd} className="space-y-2">
              <input
                type="text"
                placeholder="Nombre de la nueva lista..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded-md text-white focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium"
                >
                  Crear y Añadir
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full py-2 border border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors flex items-center justify-center gap-1.5"
            >
              <span>➕</span> Nueva lista
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { playlistApi } from '../../services/api';
import type { Playlist, PlaylistTrack } from '../../types/index';

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayTrack: (track: any, playlistTracks: any[]) => void;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  isOpen,
  onClose,
  onPlayTrack
}) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [playlistTitleEdit, setPlaylistTitleEdit] = useState('');

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const res = await playlistApi.getAll();
      if (res.data.success && res.data.data) {
        setPlaylists(res.data.data);
        if (selectedPlaylist) {
          const updated = res.data.data.find(p => p.id === selectedPlaylist.id);
          setSelectedPlaylist(updated || null);
        }
      }
    } catch (err: any) {
      console.error('Error cargando playlists:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPlaylists();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    try {
      const res = await playlistApi.create(newPlaylistName.trim(), newPlaylistDesc.trim());
      if (res.data.success && res.data.data) {
        setNewPlaylistName('');
        setNewPlaylistDesc('');
        setIsCreating(false);
        await loadPlaylists();
        setSelectedPlaylist(res.data.data);
      }
    } catch (err: any) {
      Swal.fire('Error', err.response?.data?.error || 'No se pudo crear la lista', 'error');
    }
  };

  const handleDeletePlaylist = async (playlist: Playlist) => {
    const result = await Swal.fire({
      title: '¿Eliminar lista?',
      text: `¿Estás seguro de eliminar la lista "${playlist.name}"? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await playlistApi.delete(playlist.id);
        if (selectedPlaylist?.id === playlist.id) {
          setSelectedPlaylist(null);
        }
        await loadPlaylists();
        Swal.fire('Eliminada', 'La lista de reproducción ha sido eliminada.', 'success');
      } catch (err: any) {
        Swal.fire('Error', err.response?.data?.error || 'Error al eliminar', 'error');
      }
    }
  };

  const handleSaveTitle = async () => {
    if (!selectedPlaylist || !playlistTitleEdit.trim()) return;
    try {
      const res = await playlistApi.update(selectedPlaylist.id, {
        name: playlistTitleEdit.trim()
      });
      if (res.data.success && res.data.data) {
        setSelectedPlaylist(res.data.data);
        setEditingName(false);
        await loadPlaylists();
      }
    } catch (err: any) {
      Swal.fire('Error', err.response?.data?.error || 'No se pudo renombrar la lista', 'error');
    }
  };

  const handleRemoveTrack = async (e: React.MouseEvent, track: PlaylistTrack) => {
    e.stopPropagation();
    if (!selectedPlaylist) return;
    try {
      const res = await playlistApi.removeTrack(selectedPlaylist.id, track.id);
      if (res.data.success && res.data.data) {
        setSelectedPlaylist(res.data.data);
        await loadPlaylists();
      }
    } catch (err: any) {
      Swal.fire('Error', err.response?.data?.error || 'Error al eliminar el track', 'error');
    }
  };

  const handlePlayPlaylist = (trackToStart?: PlaylistTrack) => {
    if (!selectedPlaylist || selectedPlaylist.tracks.length === 0) return;
    const tracksAsAudio = selectedPlaylist.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      path: t.path || t.name,
      size: t.size || 0,
      type: 'file',
      playlistSource: selectedPlaylist.name
    }));

    const startTrack = trackToStart
      ? tracksAsAudio.find(t => t.id === trackToStart.id) || tracksAsAudio[0]
      : tracksAsAudio[0];

    onPlayTrack(startTrack, tracksAsAudio);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
        {/* Header del Modal */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <h2 className="text-xl font-bold text-white">Listas de Reproducción</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Contenido dividido: Listas laterales + Tracks de la lista */}
        <div className="flex-1 flex overflow-hidden">
          {/* Panel Izquierdo: Lista de Playlists */}
          <div className="w-1/3 border-r border-zinc-800 flex flex-col bg-zinc-950/40">
            <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Mis Listas ({playlists.length})
              </span>
              <button
                onClick={() => setIsCreating(!isCreating)}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1"
              >
                <span>➕</span> Crear
              </button>
            </div>

            {/* Formulario para crear */}
            {isCreating && (
              <form onSubmit={handleCreate} className="p-3 border-b border-zinc-800 bg-zinc-800/30 space-y-2">
                <input
                  type="text"
                  placeholder="Nombre de la lista"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Descripción (opcional)"
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-2 py-1 text-xs text-zinc-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            )}

            {/* Listado de playlists */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
              {playlists.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-sm">
                  No hay listas creadas. ¡Crea una para comenzar!
                </div>
              ) : (
                playlists.map((playlist) => {
                  const isSelected = selectedPlaylist?.id === playlist.id;
                  return (
                    <div
                      key={playlist.id}
                      onClick={() => {
                        setSelectedPlaylist(playlist);
                        setEditingName(false);
                      }}
                      className={`p-3.5 cursor-pointer flex items-center justify-between group transition-colors ${
                        isSelected
                          ? 'bg-blue-600/10 border-l-4 border-blue-500 text-white'
                          : 'hover:bg-zinc-800/40 text-zinc-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-400' : 'text-zinc-200'}`}>
                          {playlist.name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {playlist.tracks.length} {playlist.tracks.length === 1 ? 'canción' : 'canciones'}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlaylist(playlist);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-950/60 text-zinc-500 hover:text-red-400 transition-all"
                        title="Eliminar lista"
                      >
                        🗑️
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Panel Derecho: Tracks de la playlist seleccionada */}
          <div className="flex-1 flex flex-col bg-zinc-900/60 overflow-hidden">
            {selectedPlaylist ? (
              <>
                {/* Header de la lista seleccionada */}
                <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
                  <div className="flex-1 min-w-0 mr-4">
                    {editingName ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={playlistTitleEdit}
                          onChange={(e) => setPlaylistTitleEdit(e.target.value)}
                          className="px-2 py-1 text-lg font-bold bg-zinc-950 border border-blue-500 rounded text-white focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveTitle}
                          className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded font-medium"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditingName(false)}
                          className="px-2 py-1 text-xs text-zinc-400 hover:text-white"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-white truncate">
                          {selectedPlaylist.name}
                        </h3>
                        <button
                          onClick={() => {
                            setPlaylistTitleEdit(selectedPlaylist.name);
                            setEditingName(true);
                          }}
                          className="text-zinc-400 hover:text-blue-400 text-xs p-1"
                          title="Modificar nombre"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                    {selectedPlaylist.description && (
                      <p className="text-zinc-400 text-xs mt-1 truncate">
                        {selectedPlaylist.description}
                      </p>
                    )}
                    <p className="text-zinc-500 text-xs mt-1">
                      {selectedPlaylist.tracks.length} canciones
                    </p>
                  </div>

                  {/* Acciones principales de la playlist */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePlayPlaylist()}
                      disabled={selectedPlaylist.tracks.length === 0}
                      className={`px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 shadow-md transition-all ${
                        selectedPlaylist.tracks.length > 0
                          ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer hover:shadow-blue-500/20'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <span>▶</span> Reproducir Todo
                    </button>
                  </div>
                </div>

                {/* Listado de canciones */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {selectedPlaylist.tracks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-zinc-500 space-y-2">
                      <span className="text-3xl">🎵</span>
                      <p className="text-sm">Esta lista está vacía.</p>
                      <p className="text-xs text-zinc-600">
                        Agrega canciones desde la vista principal con el botón ➕ de cada pista.
                      </p>
                    </div>
                  ) : (
                    selectedPlaylist.tracks.map((track, idx) => (
                      <div
                        key={track.id || idx}
                        onClick={() => handlePlayPlaylist(track)}
                        className="bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 rounded-lg p-3 flex items-center justify-between group cursor-pointer transition-all duration-150 hover:bg-zinc-800/40"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-xs font-mono text-zinc-500 w-5 text-right">
                            {idx + 1}
                          </span>
                          <span className="text-zinc-400 group-hover:text-blue-400 transition-colors">
                            ▶
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-blue-300">
                              {track.name}
                            </p>
                            {track.folder && (
                              <p className="text-xs text-zinc-500 truncate">
                                📁 {track.folder}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {track.size ? (
                            <span className="text-xs text-zinc-500">
                              {(track.size / 1024 / 1024).toFixed(1)} MB
                            </span>
                          ) : null}
                          <button
                            onClick={(e) => handleRemoveTrack(e, track)}
                            className="p-1.5 rounded hover:bg-red-950/60 text-zinc-500 hover:text-red-400 transition-colors"
                            title="Eliminar de esta lista"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 space-y-3">
                <span className="text-4xl">📂</span>
                <p className="text-base font-medium">Selecciona una lista de reproducción</p>
                <p className="text-sm text-zinc-600 text-center max-w-sm">
                  Haz clic en una lista del panel izquierdo o crea una nueva para escuchar y administrar tus pistas.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

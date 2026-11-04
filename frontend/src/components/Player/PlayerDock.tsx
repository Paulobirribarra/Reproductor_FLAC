import React from 'react';
import { useNowPlayingMetadata } from '../../hooks/useNowPlayingMetadata';
import { usePlayerStore } from '../../store/index';

interface SessionState {
  currentFile: any | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playlist: any[];
  playlistIndex: number;
  volume: number;
}

interface PlayerDockProps {
  sessionState: SessionState;
  onPlayPause: () => void;
  onStop?: () => void;
  onSeek: (time: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onNavigateFolder?: (folderPath: string) => void;
}

const formatTime = (seconds: number) => {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const PlayerDock: React.FC<PlayerDockProps> = ({
  sessionState,
  onPlayPause,
  onStop,
  onSeek,
  onNext,
  onPrev,
  onNavigateFolder,
}) => {
  const metadata = useNowPlayingMetadata();
  const { currentFile, setAlbumPanelOpen } = usePlayerStore();

  if (!sessionState.currentFile) {
    return null;
  }

  // Calcular ruta de la carpeta del álbum y del artista a partir del archivo actual
  const getFolderPaths = () => {
    const file = currentFile || sessionState.currentFile;
    const fullPath = file?.path || (file?.folder ? `${file.folder}/${file.name}` : '');
    if (!fullPath) return { albumFolder: '', artistFolder: '' };

    const parts = fullPath.split('/').filter(Boolean);
    if (parts.length <= 1) {
      return { albumFolder: '', artistFolder: '' };
    }

    const albumParts = parts.slice(0, -1);
    const albumFolder = albumParts.join('/');
    const artistFolder = albumParts.length > 1 ? albumParts.slice(0, -1).join('/') : albumFolder;

    return { albumFolder, artistFolder };
  };

  const handleArtistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { artistFolder, albumFolder } = getFolderPaths();
    const target = artistFolder || albumFolder;
    if (onNavigateFolder && target) {
      onNavigateFolder(target);
    }
  };

  const { albumFolder, artistFolder } = getFolderPaths();
  const canNavigate = Boolean(albumFolder || artistFolder);

  const title =
    metadata.title ||
    (sessionState.currentFile as any).displayName ||
    (sessionState.currentFile as any).parentTrackInfo?.name ||
    sessionState.currentFile.name;

  const subtitle =
    metadata.artist ||
    (sessionState.currentFile && typeof sessionState.currentFile.size === 'number'
      ? `${(sessionState.currentFile.size / 1024 / 1024).toFixed(2)} MB • FLAC`
      : 'FLAC Audio');

  return (
    <div className="fixed bottom-4 left-4 right-4 max-w-5xl mx-auto z-40 pointer-events-none">
      {/* Resplandor Ambiental (Ambient Glow de la carátula) */}
      {metadata.cover?.url ? (
        <div
          className="absolute -inset-2 rounded-3xl opacity-35 blur-2xl transition-opacity duration-700 pointer-events-none"
          style={{
            backgroundImage: `url(${metadata.cover.url})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        />
      ) : (
        <div className="absolute -inset-1 rounded-3xl opacity-20 blur-xl bg-blue-600/30 transition-opacity duration-500 pointer-events-none" />
      )}

      {/* Contenedor del Dock con efecto de cristal translúcido real */}
      <aside
        aria-label="Reproductor flotante"
        className="relative pointer-events-auto bg-zinc-900/60 backdrop-blur-2xl border border-white/10 border-t-white/20 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] p-3 transition-all duration-300"
      >
        {/* Barra de Progreso Minimalista Superior */}
      <div className="relative group mb-2 px-1">
        <input
          type="range"
          min="0"
          max={sessionState.duration || 0}
          value={sessionState.currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all group-hover:h-1.5"
        />
        <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-0.5 px-0.5">
          <span>{formatTime(sessionState.currentTime)}</span>
          <span>{formatTime(sessionState.duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        {/* Carátula y Metadatos */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={() => setAlbumPanelOpen(true)}
            className="relative w-12 h-12 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 flex-shrink-0 group cursor-pointer shadow-md hover:border-zinc-700 transition-all active:scale-95"
            title="Ver letras e información del álbum"
          >
            {metadata.cover?.url ? (
              <img
                src={metadata.cover.url}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl bg-zinc-900 text-zinc-600">
                🎵
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs">
              📜
            </div>
          </button>

          <div className="min-w-0 flex-1">
            <h4
              onClick={() => setAlbumPanelOpen(true)}
              className="text-white text-sm font-semibold truncate hover:text-blue-400 cursor-pointer transition-colors"
              title={title}
            >
              {title}
            </h4>
            <div className="text-zinc-400 text-xs truncate mt-0.5" title={subtitle}>
              {metadata.artist ? (
                <button
                  onClick={handleArtistClick}
                  className={`inline-flex items-center gap-1 text-left transition-colors ${
                    canNavigate
                      ? 'hover:text-blue-400 hover:underline cursor-pointer group'
                      : 'cursor-default'
                  }`}
                  title={canNavigate ? 'Clic para ir a la carpeta del artista' : undefined}
                >
                  <span className="truncate">{metadata.artist}</span>
                  {canNavigate && (
                    <span className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-400 flex-shrink-0">
                      ↗
                    </span>
                  )}
                </button>
              ) : (
                <span>{subtitle}</span>
              )}
            </div>
          </div>
        </div>

        {/* Controles Principales de Reproducción */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onPrev}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900/80 transition-all active:scale-95 text-sm"
            title="Pista anterior"
          >
            ⏮
          </button>

          <button
            onClick={onPlayPause}
            className={`w-11 h-11 flex items-center justify-center rounded-2xl text-white font-bold transition-all shadow-lg active:scale-95 ${
              sessionState.isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/40'
            }`}
            title={sessionState.isPlaying ? 'Pausar' : 'Reproducir'}
          >
            <span className="text-base">{sessionState.isPlaying ? '⏸' : '▶'}</span>
          </button>

          <button
            onClick={onNext}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900/80 transition-all active:scale-95 text-sm"
            title="Siguiente pista"
          >
            ⏭
          </button>

          {onStop && (
            <button
              onClick={onStop}
              className="w-8 h-8 hidden sm:flex items-center justify-center rounded-xl text-zinc-500 hover:text-red-400 hover:bg-zinc-900/60 transition-all text-xs ml-1"
              title="Detener reproducción"
            >
              ⏹
            </button>
          )}
        </div>
      </div>
    </aside>
  </div>
  );
};

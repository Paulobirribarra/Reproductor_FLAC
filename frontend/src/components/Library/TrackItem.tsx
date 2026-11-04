import React from 'react';
import type { FileInfo } from '../../types/index';
import { usePlayerStore } from '../../store/index';

interface TrackItemProps {
  file: FileInfo;
  index: number;
  onPlay: (file: FileInfo) => void;
  onDownload: (e: React.MouseEvent, file: FileInfo) => void;
  onDelete: (e: React.MouseEvent, file: FileInfo) => void;
  onAddToPlaylist?: (file: FileInfo) => void;
}

export const TrackItem: React.FC<TrackItemProps> = ({
  file,
  index,
  onPlay,
  onDownload,
  onDelete,
  onAddToPlaylist,
}) => {
  const currentFile = usePlayerStore((state) => state.currentFile);
  const isPlaying = usePlayerStore((state) => state.isPlaying);

  const isCueOrLog = /\.(cue|log|txt)$/i.test(file.name);

  // Determinar si este archivo es el que se está reproduciendo actualmente
  const isCurrentTrack = Boolean(
    currentFile &&
      ((currentFile as any).displayName === file.name ||
        currentFile.name === file.name ||
        (file.path && currentFile.path === file.path))
  );

  return (
    <div
      onClick={() => !isCueOrLog && onPlay(file)}
      className={`group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 select-none ${
        isCurrentTrack
          ? 'bg-blue-600/15 border border-blue-500/30 text-white shadow-sm'
          : 'border border-transparent hover:border-zinc-800/80 hover:bg-zinc-900/60'
      } ${!isCueOrLog ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {/* Icono / Indicador de estado */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className="w-6 text-center flex-shrink-0 font-mono text-xs">
          {isCurrentTrack ? (
            <span className="flex items-center justify-center text-blue-400">
              {isPlaying ? (
                <span className="flex gap-0.5 items-end h-3.5">
                  <span className="w-1 bg-blue-400 h-2 animate-pulse" />
                  <span className="w-1 bg-blue-400 h-3.5 animate-bounce" />
                  <span className="w-1 bg-blue-400 h-2.5 animate-pulse" />
                </span>
              ) : (
                '⏸'
              )}
            </span>
          ) : (
            <>
              <span className="group-hover:hidden text-zinc-500">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="hidden group-hover:inline text-blue-400">▶</span>
            </>
          )}
        </div>

        {/* Título y detalles */}
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium truncate transition-colors ${
              isCurrentTrack
                ? 'text-blue-400 font-semibold'
                : 'text-zinc-200 group-hover:text-white'
            }`}
            title={file.name}
          >
            {file.name}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
            <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            {file.name.toUpperCase().endsWith('.FLAC') && (
              <span
                className={`px-1.5 py-0.2 rounded font-mono text-[9px] border ${
                  isCurrentTrack
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}
              >
                FLAC
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {onAddToPlaylist && !isCueOrLog && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToPlaylist(file);
            }}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-purple-400 transition-colors text-xs"
            title="Añadir a playlist"
          >
            ➕
          </button>
        )}
        <button
          onClick={(e) => onDownload(e, file)}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-blue-400 transition-colors text-xs"
          title="Descargar archivo"
        >
          ⬇️
        </button>
        <button
          onClick={(e) => onDelete(e, file)}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors text-xs"
          title="Eliminar archivo"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

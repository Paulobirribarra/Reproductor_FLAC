import React, { useState } from 'react';

interface SessionState {
  currentFile: any | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playlist: any[];
  playlistIndex: number;
  volume: number;
}

interface PlayerFooterProps {
  sessionState: SessionState;
  files: any[];
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onNext: () => void;
  onPrev: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const formatTime = (seconds: number) => {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const PlayerFooter: React.FC<PlayerFooterProps> = ({
  sessionState,
  files,
  onPlayPause,
  onSeek,
  onNext,
  onPrev,
  isCollapsed = false,
  onToggleCollapse
}) => {
  if (!sessionState.currentFile) {
    return (
      <div className="flex-shrink-0 bg-zinc-900 border-t border-zinc-800 px-6 py-4 text-center text-zinc-500 text-sm">
        Selecciona un archivo para reproducir
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 bg-zinc-900 border-t border-zinc-800 z-40">
      <div className="px-6 py-3 space-y-3">
        {/* Progress Bar */}
        {!isCollapsed && (
          <div className="space-y-2 animate-slideUp">
            <input
              type="range"
              min="0"
              max={sessionState.duration || 0}
              value={sessionState.currentTime}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-600 hover:accent-blue-500"
            />
            <div className="flex justify-between text-xs text-zinc-500 font-mono">
              <span>{formatTime(sessionState.currentTime)}</span>
              <span>{formatTime(sessionState.duration)}</span>
            </div>
          </div>
        )}

        {/* Player Controls */}
        <div className="flex items-center justify-between gap-4">
          {/* File Info */}
          <div 
            className="flex-1 min-w-0 cursor-pointer flex items-center gap-2 hover:bg-zinc-800/50 p-1 -ml-1 rounded transition-colors"
            onClick={onToggleCollapse}
            title={isCollapsed ? "Mostrar progreso" : "Ocultar progreso"}
          >
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold truncate text-sm flex items-center gap-2">
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className={`flex-shrink-0 text-zinc-400 transform transition-transform duration-200 ${isCollapsed ? 'rotate-180' : 'rotate-0'}`}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <span className="truncate">
                  {(sessionState.currentFile as any).displayName || (sessionState.currentFile as any).parentTrackInfo?.name || sessionState.currentFile.name}
                </span>
              </h3>
            <p className="text-zinc-400 text-xs truncate">
              {sessionState.currentFile && typeof sessionState.currentFile.size === 'number'
                ? (sessionState.currentFile.size / 1024 / 1024).toFixed(2)
                : 'N/A'} MB
              {(sessionState.currentFile as any).isChunk && (
                <span className="ml-2">• Parte {((sessionState.currentFile as any).chunkIndex || 0) + 1}</span>
              )}
            </p>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onPrev}
              className="p-2 text-zinc-300 rounded-lg transition-all duration-200 hover:bg-zinc-800 hover:text-white"
              title="Anterior"
            >
              ⏮
            </button>

            <button
              onClick={onPlayPause}
              className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 ${sessionState.isPlaying
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
            >
              {sessionState.isPlaying ? '⏸ Pausar' : '▶ Reproducir'}
            </button>

            <button
              onClick={onNext}
              className="p-2 text-zinc-300 rounded-lg transition-all duration-200 hover:bg-zinc-800 hover:text-white"
              title="Siguiente"
            >
              ⏭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

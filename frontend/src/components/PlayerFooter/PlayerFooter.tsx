import React from 'react';

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
}

const formatTime = (seconds: number) => {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const PlayerFooter: React.FC<PlayerFooterProps> = ({ 
  , 
  files,
  onPlayPause,
  onSeek,
  onNext,
  onPrev
}) => {
  if (!sessionState.currentFile) {
    return (
      <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-800 border-t border-blue-900 py-2 text-center text-gray-400 text-sm">
        Selecciona un archivo para reproducir
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-800 border-t border-blue-900 shadow-2xl z-40">
      <div className="max-w-full px-6 py-4">
        {/* Progress bar */}
        <div className="mb-3">
          <input
            type="range"
            min="0"
            max={sessionState.duration || 0}
            value={sessionState.currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full h-1 bg-blue-400 rounded appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #4ae7ec 0%, #13afec ${
                sessionState.duration ? (sessionState.currentTime / sessionState.duration) * 100 : 0
              }%, #13afec ${
                sessionState.duration ? (sessionState.currentTime / sessionState.duration) * 100 : 0
              }%, #4ae7ec 100%)`,
            }}
          />
        </div>

        {/* Player controls */}
        <div className="flex items-center justify-between gap-4">
          {/* File Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold truncate text-sm">
              {sessionState.currentFile.name}
            </h3>
            <p className="text-blue-100 text-xs truncate">
              {sessionState.currentFile && typeof sessionState.currentFile.size === 'number' 
                ? (sessionState.currentFile.size / 1024 / 1024).toFixed(2) 
                : 'N/A'} MB
            </p>
          </div>

          {/* Time Display */}
          <div className="text-xs text-blue-100 whitespace-nowrap font-mono">
            <span>{formatTime(sessionState.currentTime)}</span>
            <span className="mx-2">/</span>
            <span>{formatTime(sessionState.duration)}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={onPrev}
              className="p-2 text-white hover:bg-blue-700 rounded-lg transition-colors"
              title="Anterior"
            >
              ⏮
            </button>
            
            <button
              onClick={onPlayPause}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                sessionState.isPlaying
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {sessionState.isPlaying ? '⏸' : '▶'}
            </button>
            
            <button
              onClick={onNext}
              className="p-2 text-white hover:bg-blue-700 rounded-lg transition-colors"
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

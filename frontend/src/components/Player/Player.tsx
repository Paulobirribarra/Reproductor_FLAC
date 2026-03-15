import React, { useRef, useEffect, useState } from 'react';
import { usePlayerStore } from '../../store/index';
import { filesApi } from '../../services/api';
import type { FileInfo } from '../../types/index';

interface PlayerProps {
  file: FileInfo;
  currentPath?: string;
  onEnded?: () => void;
}

export const Player: React.FC<PlayerProps> = ({ file, currentPath = '', onEnded }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { 
    isPlaying, 
    currentTime, 
    duration, 
    bufferProgress,
    isBuffering,
    setIsPlaying, 
    setCurrentTime, 
    setDuration,
    setBufferProgress,
    setIsBuffering,
  } = usePlayerStore();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      // Reproducir siguiente archivo si existe callback
      onEnded?.();
    };
    const handleProgress = () => {
      if (audio.buffered.length > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        const progress = (bufferedEnd / audio.duration) * 100;
        setBufferProgress(Math.min(progress, 100));
      }
    };
    const handleLoadStart = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('progress', handleProgress);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('progress', handleProgress);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [setCurrentTime, setDuration, setIsPlaying, setBufferProgress, setIsBuffering, onEnded]);

  // Sincronizar estado de play/pause con el elemento de audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch((error) => {
        console.error('Error playing audio:', error);
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, setIsPlaying]);

  // Resetear tiempo cuando cambia el archivo y auto-play si estaba reproduciendo
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setBufferProgress(0); // Reset buffer progress on file change
    }
  }, [file, setCurrentTime, setBufferProgress]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || !Number.isFinite(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white shadow-lg">
      <audio
        ref={audioRef}
        src={filesApi.getFileStream(file.name, currentPath)}
        crossOrigin="anonymous"
      />

      <div className="mb-4">
        <h3 className="text-xl font-bold truncate">{file.name}</h3>
        <p className="text-blue-100 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
        {isBuffering && (
          <p className="text-blue-200 text-xs mt-1 animate-pulse">
            ⏳ Cargando archivo... ({Math.round(bufferProgress)}%)
          </p>
        )}
      </div>

      <div className="space-y-4">
        {/* Buffer indicator */}
        {isBuffering && (
          <div className="flex items-center gap-2 text-sm text-blue-100">
            <div className="animate-spin">⏳</div>
            <span>Cargando... {Math.round(bufferProgress)}%</span>
          </div>
        )}

        {/* Buffer bar */}
        <div className="bg-blue-900 rounded-full h-1">
          <div
            className="bg-blue-300 h-1 rounded-full transition-all duration-300"
            style={{ width: `${bufferProgress}%` }}
          />
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-blue-400 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #2563eb 0%, #2563eb ${
                duration ? (currentTime / duration) * 100 : 0
              }%, #93c5fd ${duration ? (currentTime / duration) * 100 : 0}%, #93c5fd 100%)`,
            }}
          />
          <div className="flex justify-between text-xs text-blue-100">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <button
          onClick={handlePlayPause}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
            isPlaying
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {isPlaying ? '⏸ Pausar' : '▶ Reproducir'}
        </button>
      </div>
    </div>
  );
};

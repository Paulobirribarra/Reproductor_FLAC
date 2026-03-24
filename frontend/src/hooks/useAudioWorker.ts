import { useRef, useEffect, useState, useCallback } from 'react';
import type { FileInfo } from '../types/index';
import { usePerformanceMonitor } from './usePerformanceMonitor';

interface AudioSession {
  currentFile: any | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playlist: any[];
  playlistIndex: number;
  volume: number;
}

const initialState: AudioSession = {
  currentFile: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playlist: [],
  playlistIndex: 0,
  volume: 1,
};

export const useAudioWorker = (onFileEnded?: () => void) => {
  const workerRef = useRef<Worker | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const handlersRef = useRef<{ handleWorkerMessage?: (event: MessageEvent) => void; handleTimeUpdate?: () => void; handleLoadedMetadata?: () => void; handleCanPlayThrough?: () => void; handleEnded?: () => void; handlePlay?: () => void; handlePause?: () => void; handleError?: (e: Event) => void }>({});
  const onFileEndedRef = useRef(onFileEnded);
  const [sessionState, setSessionState] = useState<AudioSession>(initialState);
  const recordPerformance = usePerformanceMonitor('AudioWorker');
  const lastUpdateTimeRef = useRef(0);
  const UPDATE_THROTTLE_MS = 200; // Actualizar estado máximo cada 200ms

  // Actualizar la ref cuando cambie el callback (sin causar reinicialización)
  useEffect(() => {
    onFileEndedRef.current = onFileEnded;
  }, [onFileEnded]);

  // Inicializar worker y audio
  useEffect(() => {
    // Solo crear el worker si no existe
    if (!workerRef.current) {
      try {
        // console.log('[useAudioWorker] Creando worker...');
        workerRef.current = new Worker(
          new URL('../workers/audioWorker.ts', import.meta.url),
          { type: 'module' }
        );
      } catch (error) {
        console.error('[useAudioWorker] Error creando worker:', error);
        return;
      }
    }

    // Solo crear el audio element si no existe
    if (!audioRef.current) {
      try {
        // console.log('[useAudioWorker] Creando audio element...');
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.style.display = 'none';
        document.body.appendChild(audio);
        audioRef.current = audio;
        // console.log('[useAudioWorker] Audio element creado y adjuntado al DOM');
      } catch (error) {
        console.error('[useAudioWorker] Error creando audio:', error);
        return;
      }
    }

    const audio = audioRef.current;
    const worker = workerRef.current;

    // Definir handlers
    const handleWorkerMessage = (event: MessageEvent) => {
      recordPerformance();

      const { type, payload } = event.data;
      const now = Date.now();

      if (type === 'STATE_UPDATE') {
        // Throttle las actualizaciones de estado para evitar re-renders excesivos
        if (now - lastUpdateTimeRef.current > UPDATE_THROTTLE_MS) {
          setSessionState(payload);
          lastUpdateTimeRef.current = now;
        }
      } else if (type === 'PLAYBACK_ENDED') {
        onFileEndedRef.current?.();
        lastUpdateTimeRef.current = now;
      } else if (type === 'AUDIO_ERROR') {
        console.error('[useAudioWorker] Error de audio:', payload.error);
      } else if (type === 'PRELOAD_READY') {
        console.log('[useAudioWorker] Precarga lista:', payload.file.name);
      } else if (type === 'PRELOAD_ERROR') {
        console.warn('[useAudioWorker] Error en precarga:', payload.error);
      } else if (type === 'PLAY_FILE') {
        handlePlayFile(payload.streamUrl);
      } else if (type === 'PAUSE_AUDIO') {
        if (audio) {
          audio.pause();
        }
      } else if (type === 'SEEK_AUDIO') {
        if (audio) {
          audio.currentTime = payload.time;
        }
      } else if (type === 'SET_AUDIO_VOLUME') {
        if (audio) {
          audio.volume = payload.volume;
        }
      }
    };

    const handleTimeUpdate = () => {
      if (worker && audio.currentTime > 0) {
        worker.postMessage({
          type: 'UPDATE_AUDIO_TIME',
          payload: { currentTime: audio.currentTime }
        });
      }
    };

    const handleLoadedMetadata = () => {
      // console.log('[useAudioWorker] Loaded metadata, duration:', audio.duration);
      if (worker && audio.duration) {
        worker.postMessage({
          type: 'UPDATE_AUDIO_DURATION',
          payload: { duration: audio.duration }
        });
      }
    };

    const handleCanPlayThrough = () => {
      console.log('[useAudioWorker] Can play through');
      if (worker && audio.duration && !Number.isNaN(audio.duration)) {
        worker.postMessage({
          type: 'UPDATE_AUDIO_DURATION',
          payload: { duration: audio.duration }
        });
      }
    };

    const handleEnded = () => {
      console.log('[useAudioWorker] Audio ended');
      if (worker) {
        worker.postMessage({ type: 'AUDIO_ENDED' });
      }
    };

    const handlePlay = () => {
      console.log('[useAudioWorker] Audio play event');
    };

    const handlePause = () => {
      console.log('[useAudioWorker] Audio pause event');
    };

    const handleError = (e: Event) => {
      console.error('[useAudioWorker] Audio error:', audio.error);
      if (worker) {
        worker.postMessage({
          type: 'AUDIO_ERROR',
          payload: { error: audio.error?.message || 'Unknown error' }
        });
      }
    };

    // Guardar handlers en ref para poder removerlos después
    handlersRef.current = {
      handleWorkerMessage,
      handleTimeUpdate,
      handleLoadedMetadata,
      handleCanPlayThrough,
      handleEnded,
      handlePlay,
      handlePause,
      handleError
    };

    // Agregar listeners
    worker.addEventListener('message', handleWorkerMessage);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    console.log('[useAudioWorker] Listeners agregados');

    // Inicializar el worker (esto hará que cree el filePreloadWorker)
    worker.postMessage({ type: 'INITIALIZE' });

    // Cleanup - remover listeners
    return () => {
      console.log('[useAudioWorker] Removiendo listeners');
      if (handlersRef.current.handleWorkerMessage) {
        worker.removeEventListener('message', handlersRef.current.handleWorkerMessage);
      }
      if (handlersRef.current.handleTimeUpdate) {
        audio.removeEventListener('timeupdate', handlersRef.current.handleTimeUpdate);
      }
      if (handlersRef.current.handleLoadedMetadata) {
        audio.removeEventListener('loadedmetadata', handlersRef.current.handleLoadedMetadata);
      }
      if (handlersRef.current.handleCanPlayThrough) {
        audio.removeEventListener('canplaythrough', handlersRef.current.handleCanPlayThrough);
      }
      if (handlersRef.current.handleEnded) {
        audio.removeEventListener('ended', handlersRef.current.handleEnded);
      }
      if (handlersRef.current.handlePlay) {
        audio.removeEventListener('play', handlersRef.current.handlePlay);
      }
      if (handlersRef.current.handlePause) {
        audio.removeEventListener('pause', handlersRef.current.handlePause);
      }
      if (handlersRef.current.handleError) {
        audio.removeEventListener('error', handlersRef.current.handleError);
      }
    };
  }, []);

  // Función para reproducir archivo - versión simplificada (sin WASM)
  const handlePlayFile = (streamUrl: string) => {
    if (!audioRef.current) return;

    console.log('[useAudioWorker] Reproduciendo:', streamUrl);
    const audio = audioRef.current;

    audio.src = streamUrl;
    console.log('[useAudioWorker] Audio src set, esperando metadata...');
    audio.load();
    console.log('[useAudioWorker] Audio load() llamado');

    setTimeout(() => {
      audio.play().catch((error) => {
        console.error('[useAudioWorker] Error playing audio:', error);
      });
    }, 100);
  };

  // Actualizar volumen cuando cambie en sesión
  useEffect(() => {
    if (audioRef.current && sessionState) {
      audioRef.current.volume = Math.max(0, Math.min(1, sessionState.volume));
    }
  }, [sessionState?.volume]);

  // Métodos públicos
  const play = useCallback((file: FileInfo, playlist: FileInfo[] = []) => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'PLAY',
        payload: { file, playlist },
      });
    }
  }, []);

  const pause = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'PAUSE' });
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'SEEK',
        payload: { time },
      });
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'SET_VOLUME',
        payload: { volume },
      });
    }
  }, []);

  const next = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'NEXT' });
    }
  }, []);

  const prev = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'PREV' });
    }
  }, []);

  const setPlaylist = useCallback((playlist: FileInfo[]) => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'SET_PLAYLIST',
        payload: { playlist },
      });
    }
  }, []);

  const getState = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'GET_STATE' });
    }
  }, []);

  return {
    sessionState,
    play,
    pause,
    seek,
    setVolume,
    next,
    prev,
    setPlaylist,
    getState,
    worker: workerRef.current,
    audioRef,
  };
};

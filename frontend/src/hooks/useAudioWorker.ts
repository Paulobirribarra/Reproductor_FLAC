import { useRef, useEffect, useState, useCallback } from 'react';
import type { FileInfo } from '../types/index';
import toast from 'react-hot-toast';
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
  const sessionStateRef = useRef<AudioSession>(initialState);
  const recordPerformance = usePerformanceMonitor('AudioWorker');
  const lastUpdateTimeRef = useRef(0);
  const retryCountRef = useRef(0);
  const currentStreamUrlRef = useRef<string | null>(null);
  const isRecoveringRef = useRef(false);
  const UPDATE_THROTTLE_MS = 200; // Actualizar estado máximo cada 200ms

  // Actualizar la ref cuando cambie el callback (sin causar reinicialización)
  useEffect(() => {
    onFileEndedRef.current = onFileEnded;
  }, [onFileEnded]);

  // Función para reproducir archivo - versión con auto-reintento
  const handlePlayFile = (streamUrl: string, resumeTime?: number) => {
    if (!audioRef.current) return;

    currentStreamUrlRef.current = streamUrl;
    if (resumeTime === undefined) {
      retryCountRef.current = 0;
    }

    const audio = audioRef.current;
    // Si estamos reanudando tras caída de conexión, agregar un timestamp para romper socket roto
    const finalUrl = resumeTime !== undefined 
      ? `${streamUrl}${streamUrl.includes('?') ? '&' : '?'}_r=${Date.now()}`
      : streamUrl;

    audio.src = finalUrl;
    audio.load();

    setTimeout(() => {
      if (resumeTime !== undefined && resumeTime > 0) {
        audio.currentTime = resumeTime;
      }
      audio.play().catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('[useAudioWorker] Error playing audio:', error);
        }
      });
    }, 100);
  };

  // Inicializar worker y audio
  useEffect(() => {
    if (!workerRef.current) {
      try {
        workerRef.current = new Worker(
          new URL('../workers/audioWorker.ts', import.meta.url),
          { type: 'module' }
        );
      } catch (error) {
        console.error('[useAudioWorker] Error creando worker:', error);
        return;
      }
    }

    if (!audioRef.current) {
      try {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.style.display = 'none';
        document.body.appendChild(audio);
        audioRef.current = audio;
      } catch (error) {
        console.error('[useAudioWorker] Error creando audio:', error);
        return;
      }
    }

    const audio = audioRef.current;
    const worker = workerRef.current;

    // Diccionario de acciones del Worker (Elimina los if / else anidados)
    const workerActions: Record<string, (payload: any) => void> = {
      'STATE_UPDATE': (payload: AudioSession) => {
        const now = Date.now();
        const prev = sessionStateRef.current;
        const stateChanged =
          prev.isPlaying !== payload.isPlaying ||
          prev.currentFile?.path !== payload.currentFile?.path ||
          prev.playlistIndex !== payload.playlistIndex;

        if (stateChanged || now - lastUpdateTimeRef.current > UPDATE_THROTTLE_MS) {
          lastUpdateTimeRef.current = now;
          sessionStateRef.current = payload;
          setSessionState(payload);
        }
      },
      'PLAYBACK_ENDED': () => {
        onFileEndedRef.current?.();
        lastUpdateTimeRef.current = Date.now();
      },
      'AUDIO_ERROR': (payload) => {
        console.error('[useAudioWorker] Error de audio:', payload.error);
      },
      'PRELOAD_READY': (payload) => {
        console.log('[useAudioWorker] Precarga lista:', payload.file.name);
      },
      'PRELOAD_ERROR': (payload) => {
        console.warn('[useAudioWorker] Error en precarga:', payload.error);
      },
      'PLAY_FILE': (payload) => {
        handlePlayFile(payload.streamUrl);
      },
      'PAUSE_AUDIO': () => {
        audio?.pause();
      },
      'RESUME_AUDIO': () => {
        audio?.play().catch((error) => {
          if (error.name !== 'AbortError') {
            console.error('[useAudioWorker] Error reanudando audio:', error);
          }
        });
      },
      'STOP_AUDIO': () => {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      },
      'SEEK_AUDIO': (payload) => {
        if (audio) {
          audio.currentTime = payload.time;
        }
      },
      'PLAYBACK_ERROR': (payload) => {
        console.error('[useAudioWorker] Playback error:', payload.error);
        toast.error(`Error de reproducción: ${payload.error}`);
        // Reset playback state to avoid stuck UI
        setSessionState((s) => ({ ...s, isPlaying: false }));
      },
      'SET_AUDIO_VOLUME': (payload) => {
        if (audio) {
          audio.volume = payload.volume;
        }
      },
    };

    const handleWorkerMessage = (event: MessageEvent) => {
      recordPerformance();
      const { type, payload } = event.data;
      const action = workerActions[type];

      if (action) {
        action(payload);
      } else {
        // console.warn(`[useAudioWorker] Mensaje desconocido: ${type}`);
      }
    };

    const handleTimeUpdate = () => {
      if (worker && audio.currentTime >= 0) {
        worker.postMessage({
          type: 'UPDATE_AUDIO_TIME',
          payload: { currentTime: audio.currentTime }
        });
      }
    };

    const handleLoadedMetadata = () => {
      if (worker && audio.duration) {
        worker.postMessage({
          type: 'UPDATE_AUDIO_DURATION',
          payload: { duration: audio.duration }
        });
      }
    };

    const handleCanPlayThrough = () => {
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
      if (!sessionStateRef.current.isPlaying) {
        sessionStateRef.current = { ...sessionStateRef.current, isPlaying: true };
        setSessionState(sessionStateRef.current);
      }
    };
    const handlePause = () => {
      if (sessionStateRef.current.isPlaying) {
        sessionStateRef.current = { ...sessionStateRef.current, isPlaying: false };
        setSessionState(sessionStateRef.current);
      }
    };

    const handleError = () => {
      console.error('[useAudioWorker] Audio error:', audio.error);
      const currentTime = audio.currentTime;
      const streamUrl = currentStreamUrlRef.current;

      // Si falló por caída de red/túnel (net::ERR_HTTP2_PING_FAILED o similar) y teníamos reproducción activa
      if (streamUrl && retryCountRef.current < 3 && !isRecoveringRef.current) {
        retryCountRef.current += 1;
        isRecoveringRef.current = true;
        console.warn(`[useAudioWorker] Detectada interrupción de red. Reintentando reproducción (${retryCountRef.current}/3) en segundo: ${currentTime}s`);

        setTimeout(() => {
          handlePlayFile(streamUrl, currentTime);
          isRecoveringRef.current = false;
        }, 1200);
        return;
      }

      if (worker) {
        worker.postMessage({
          type: 'AUDIO_ERROR',
          payload: { error: audio.error?.message || 'Error de conexión / streaming interrumpido' }
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

    // Inicializar el worker
    worker.postMessage({ type: 'INITIALIZE' });

    // Cleanup - remover listeners
    return () => {
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

  // Actualizar volumen cuando cambie en sesión
  useEffect(() => {
    if (audioRef.current && sessionState) {
      audioRef.current.volume = Math.max(0, Math.min(1, sessionState.volume));
    }
  }, [sessionState?.volume]);

  // Métodos públicos
  const play = useCallback((file: FileInfo, playlist: FileInfo[] = []) => {
    const next = {
      ...sessionStateRef.current,
      currentFile: file,
      isPlaying: true,
      currentTime: 0,
    };
    sessionStateRef.current = next;
    setSessionState(next);
    workerRef.current?.postMessage({ type: 'PLAY', payload: { file, playlist } });
  }, []);

  const pause = useCallback(() => {
    const next = { ...sessionStateRef.current, isPlaying: false };
    sessionStateRef.current = next;
    setSessionState(next);
    workerRef.current?.postMessage({ type: 'PAUSE' });
  }, []);

  const resume = useCallback(() => {
    const next = { ...sessionStateRef.current, isPlaying: true };
    sessionStateRef.current = next;
    setSessionState(next);
    workerRef.current?.postMessage({ type: 'RESUME' });
  }, []);

  const stop = useCallback(() => {
    const next = { ...sessionStateRef.current, isPlaying: false, currentTime: 0 };
    sessionStateRef.current = next;
    setSessionState(next);
    workerRef.current?.postMessage({ type: 'STOP' });
  }, []);

  const seek = useCallback((time: number) => {
    workerRef.current?.postMessage({ type: 'SEEK', payload: { time } });
  }, []);

  const setVolume = useCallback((volume: number) => {
    workerRef.current?.postMessage({ type: 'SET_VOLUME', payload: { volume } });
  }, []);

  const next = useCallback(() => {
    workerRef.current?.postMessage({ type: 'NEXT' });
  }, []);

  const prev = useCallback(() => {
    workerRef.current?.postMessage({ type: 'PREV' });
  }, []);

  const setPlaylist = useCallback((playlist: FileInfo[]) => {
    workerRef.current?.postMessage({ type: 'SET_PLAYLIST', payload: { playlist } });
  }, []);

  const getState = useCallback(() => {
    workerRef.current?.postMessage({ type: 'GET_STATE' });
  }, []);

  return {
    sessionState,
    play,
    pause,
    resume,
    stop,
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
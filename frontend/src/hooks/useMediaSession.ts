import { useEffect, useRef } from 'react';
import type { AudioSessionState } from '../types/index';
import { useNowPlayingMetadata } from './useNowPlayingMetadata';

interface MediaSessionControls {
  play: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (time: number) => void;
  next: () => void;
  prev: () => void;
}

/**
 * Hook modular para sincronizar el estado del reproductor con la MediaSession API del navegador.
 * Permite:
 * 1. Mostrar controles nativos y carátula en la pantalla de bloqueo y barra de notificaciones (Android, iOS, Windows).
 * 2. Prevenir que el sistema operativo congele o suspenda la reproducción multimedia en segundo plano.
 * 3. Manejar eventos de hardware (teclado multimedia, auriculares bluetooth, reloj inteligente).
 */
export function useMediaSession(
  sessionState: AudioSessionState,
  controls: MediaSessionControls
) {
  const metadata = useNowPlayingMetadata();
  const controlsRef = useRef(controls);

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  // 1. Configurar Action Handlers de la MediaSession
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const ms = navigator.mediaSession;

    const actionHandlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => controlsRef.current.resume()],
      ['pause', () => controlsRef.current.pause()],
      ['stop', () => controlsRef.current.stop()],
      ['nexttrack', () => controlsRef.current.next()],
      ['previoustrack', () => controlsRef.current.prev()],
      [
        'seekto',
        (details) => {
          if (details.seekTime !== undefined && details.seekTime !== null) {
            controlsRef.current.seek(details.seekTime);
          }
        },
      ],
      [
        'seekforward',
        (details) => {
          const skipTime = details.seekOffset || 10;
          controlsRef.current.seek(sessionState.currentTime + skipTime);
        },
      ],
      [
        'seekbackward',
        (details) => {
          const skipTime = details.seekOffset || 10;
          controlsRef.current.seek(Math.max(0, sessionState.currentTime - skipTime));
        },
      ],
    ];

    actionHandlers.forEach(([action, handler]) => {
      try {
        ms.setActionHandler(action, handler);
      } catch (e) {
        // Algunas plataformas/navegadores no soportan todas las acciones (ej: seekforward/backward)
      }
    });

    return () => {
      actionHandlers.forEach(([action]) => {
        try {
          ms.setActionHandler(action, null);
        } catch (e) {
          // ignore
        }
      });
    };
  }, [sessionState.currentTime]);

  // 2. Sincronizar Metadata (Título, Artista, Álbum, Carátula)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const file = sessionState.currentFile;
    if (!file) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const title = metadata.title || file.displayName || file.name.replace(/\.[^/.]+$/, '');
    const artist = metadata.artist || 'Desconocido';
    const album = metadata.album || 'Álbum Desconocido';

    const artwork: MediaImage[] = [];
    if (metadata.cover?.url) {
      artwork.push({
        src: metadata.cover.url,
        sizes: '512x512',
        type: metadata.cover.type || 'image/jpeg',
      });
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album,
      artwork,
    });
  }, [sessionState.currentFile, metadata.title, metadata.artist, metadata.album, metadata.cover?.url]);

  // 3. Sincronizar Estado de Reproducción (playing / paused)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.playbackState = sessionState.isPlaying ? 'playing' : 'paused';
  }, [sessionState.isPlaying]);

  // 4. Sincronizar Posición y Duración (barra de progreso en bloqueo)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;

    if (
      Number.isFinite(sessionState.duration) &&
      sessionState.duration > 0 &&
      Number.isFinite(sessionState.currentTime) &&
      sessionState.currentTime >= 0 &&
      sessionState.currentTime <= sessionState.duration
    ) {
      try {
        navigator.mediaSession.setPositionState({
          duration: sessionState.duration,
          playbackRate: 1.0,
          position: sessionState.currentTime,
        });
      } catch (error) {
        // Ignorar posibles discrepancias transitorias en la precisión del tiempo
      }
    }
  }, [sessionState.currentTime, sessionState.duration]);
}

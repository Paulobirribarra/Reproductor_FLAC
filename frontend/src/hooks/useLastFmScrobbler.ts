import { useEffect, useRef } from 'react';
import { useNowPlayingMetadata } from './useNowPlayingMetadata';
import { lastFmApi } from '../services/api';
import type { AudioSessionState } from '../types/index';

/**
 * Hook para gestionar Now Playing y Scrobbling automático a Last.fm
 * Sigue las reglas de Last.fm:
 * - Update Now Playing al iniciar el tema
 * - Scrobble al llegar al 50% de la pista o 240 segundos (4 minutos)
 */
export function useLastFmScrobbler(sessionState: AudioSessionState) {
  const metadata = useNowPlayingMetadata();
  const currentTrackIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hasScrobbledRef = useRef<boolean>(false);
  const hasNowPlayingSentRef = useRef<boolean>(false);

  // 1. Manejar cambio de pista
  useEffect(() => {
    const file = sessionState.currentFile;
    if (!file) {
      currentTrackIdRef.current = null;
      startTimeRef.current = null;
      hasScrobbledRef.current = false;
      hasNowPlayingSentRef.current = false;
      return;
    }

    const trackId = `${file.path || file.name}`;
    if (currentTrackIdRef.current !== trackId) {
      // Nueva pista seleccionada
      currentTrackIdRef.current = trackId;
      startTimeRef.current = Math.floor(Date.now() / 1000);
      hasScrobbledRef.current = false;
      hasNowPlayingSentRef.current = false;
    }
  }, [sessionState.currentFile?.name, sessionState.currentFile?.path]);

  // 2. Enviar Now Playing cuando la canción empieza a reproducirse y hay metadatos o nombre
  useEffect(() => {
    if (!sessionState.isPlaying || !sessionState.currentFile || hasNowPlayingSentRef.current) {
      return;
    }

    const artist = metadata.artist || 'Unknown Artist';
    const track = metadata.title || sessionState.currentFile.name.replace(/\.[^/.]+$/, '');
    const album = metadata.album;
    const duration = sessionState.duration || metadata.duration;

    lastFmApi
      .updateNowPlaying({
        artist,
        track,
        album,
        duration,
      })
      .then(() => {
        hasNowPlayingSentRef.current = true;
      })
      .catch((err) => {
        console.warn('[useLastFmScrobbler] Error notificando now playing:', err.message);
      });
  }, [sessionState.isPlaying, sessionState.currentFile, metadata.artist, metadata.title, sessionState.duration]);

  // 3. Evaluar condición de scrobble en tiempo de reproducción
  useEffect(() => {
    if (
      !sessionState.isPlaying ||
      !sessionState.currentFile ||
      hasScrobbledRef.current ||
      !startTimeRef.current
    ) {
      return;
    }

    const duration = sessionState.duration || metadata.duration || 0;
    const currentTime = sessionState.currentTime;

    // Regla de Last.fm: scrobble a los 240 segundos o al 50% de la duración (con mínimo de 30s)
    const threshold = duration > 0 ? Math.min(duration / 2, 240) : 240;

    if (currentTime >= threshold && threshold >= 30) {
      const artist = metadata.artist || 'Unknown Artist';
      const track = metadata.title || sessionState.currentFile.name.replace(/\.[^/.]+$/, '');
      const album = metadata.album;
      const timestamp = startTimeRef.current;

      hasScrobbledRef.current = true;

      lastFmApi
        .scrobble({
          artist,
          track,
          album,
          timestamp,
        })
        .then(() => {
          console.log(`[useLastFmScrobbler] ✅ Scrobble registrado: "${track}" - ${artist}`);
        })
        .catch((err) => {
          console.error('[useLastFmScrobbler] Error registrando scrobble:', err.message);
        });
    }
  }, [sessionState.currentTime, sessionState.isPlaying, sessionState.duration, metadata]);
}

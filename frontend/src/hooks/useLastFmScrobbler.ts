import { useEffect, useRef } from 'react';
import { useNowPlayingMetadata } from './useNowPlayingMetadata';
import { lastFmApi } from '../services/api';
import type { AudioSessionState } from '../types/index';

/**
 * Hook para gestionar Now Playing y Scrobbling automático a Last.fm
 * Sigue las reglas de Last.fm:
 * - Update Now Playing al iniciar el tema
 * - Scrobble al llegar al 50% de la pista o 240 segundos (4 minutos) con validación de tiempo real
 */
export function useLastFmScrobbler(sessionState: AudioSessionState) {
  const metadata = useNowPlayingMetadata();
  const currentTrackIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hasScrobbledRef = useRef<boolean>(false);
  const hasNowPlayingSentRef = useRef<boolean>(false);

  // Control de tiempo real reproducido y detección de saltos bruscos
  const accumulatedPlayTimeRef = useRef<number>(0);
  const lastTimeCheckRef = useRef<number>(0);
  const isInvalidatedRef = useRef<boolean>(false);
  const jumpDetectedAtRef = useRef<number | null>(null);

  // 1. Manejar cambio de pista
  useEffect(() => {
    const file = sessionState.currentFile;
    if (!file) {
      currentTrackIdRef.current = null;
      startTimeRef.current = null;
      hasScrobbledRef.current = false;
      hasNowPlayingSentRef.current = false;
      accumulatedPlayTimeRef.current = 0;
      lastTimeCheckRef.current = 0;
      isInvalidatedRef.current = false;
      jumpDetectedAtRef.current = null;
      return;
    }

    const trackId = `${file.path || file.name}`;
    if (currentTrackIdRef.current !== trackId) {
      currentTrackIdRef.current = trackId;
      startTimeRef.current = Math.floor(Date.now() / 1000);
      hasScrobbledRef.current = false;
      hasNowPlayingSentRef.current = false;
      accumulatedPlayTimeRef.current = 0;
      lastTimeCheckRef.current = sessionState.currentTime;
      isInvalidatedRef.current = false;
      jumpDetectedAtRef.current = null;
    }
  }, [sessionState.currentFile?.name, sessionState.currentFile?.path]);

  // 2. Enviar Now Playing cuando la canción empieza a reproducirse
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
        duration 
      })
      .then(() => {
        hasNowPlayingSentRef.current = true;
      })
      .catch((err) => {
        console.warn('[useLastFmScrobbler] Error notificando now playing:', err.message);
      });
  }, [sessionState.isPlaying, sessionState.currentFile, metadata.artist, metadata.title, sessionState.duration]);

  // 3. Evaluar condición de scrobble con tiempo acumulado y manejo estricto de seeks
  useEffect(() => {
    if (
      !sessionState.isPlaying ||
      !sessionState.currentFile ||
      hasScrobbledRef.current ||
      isInvalidatedRef.current ||
      !startTimeRef.current
    ) {
      lastTimeCheckRef.current = sessionState.currentTime;
      return;
    }

    const currentTime = sessionState.currentTime;
    const lastTime = lastTimeCheckRef.current;
    const timeDelta = currentTime - lastTime;

    const duration = sessionState.duration || metadata.duration || 0;
    const threshold = duration > 0 ? Math.min(duration / 2, 240) : 240;

    // Detectar si hubo un salto brusco (seek)
    if (Math.abs(timeDelta) > 3) {
      //console.log(`[useLastFmScrobbler] Salto detectado en la reproducción. Delta: ${timeDelta.toFixed(1)}s`);
      
      if (timeDelta > 0) {
        // Si el usuario adelanta y cruza o cae en una posición igual o superior al umbral sin haberlo escuchado
        if (currentTime >= threshold) {
          isInvalidatedRef.current = true;
          //console.log(`[useLastFmScrobbler] Salto superó el umbral (${threshold.toFixed(1)}s). Scrobble invalidado para esta reproducción.`);
          return;
        } else {
          // Si saltó pero se quedó antes del umbral, reseteamos el acumulador y registramos el salto
          accumulatedPlayTimeRef.current = 0;
          jumpDetectedAtRef.current = Date.now();
          //console.log(`[useLastFmScrobbler] Salto antes del umbral. Acumulador reseteado a 0. Esperando tiempo efectivo restante...`);
        }
      }
    } else if (timeDelta > 0) {
      // Incremento normal de reproducción segundo a segundo
      accumulatedPlayTimeRef.current += timeDelta;
    }

    lastTimeCheckRef.current = currentTime;

    const hasReachedTime = currentTime >= threshold;
    // Exigimos que el tiempo real acumulado sea el umbral completo (o equivalente legítimo)
    const hasEnoughRealPlaytime = accumulatedPlayTimeRef.current >= threshold;

    if (hasReachedTime && threshold >= 30 && hasEnoughRealPlaytime && !isInvalidatedRef.current) {
      // Si tenemos registrado cuándo ocurrió el salto, calculamos la diferencia exacta
      if (jumpDetectedAtRef.current !== null) {
        const secondsElapsed = ((Date.now() - jumpDetectedAtRef.current) / 1000).toFixed(2);
        //console.log(`[useLastFmScrobbler] Tiempo transcurrido desde el salto hasta el scrobble: ${secondsElapsed} segundos.`);
        jumpDetectedAtRef.current = null;
      }

      const artist = metadata.artist || 'Unknown Artist';
      const track = metadata.title || sessionState.currentFile.name.replace(/\.[^/.]+$/, '');
      const album = metadata.album;
      const timestamp = startTimeRef.current;

      hasScrobbledRef.current = true;

      lastFmApi
        .scrobble({ artist, track, album, timestamp })
        .then(() => {
          //console.log(`[useLastFmScrobbler] Scrobble registrado legítimamente: "${track}" - ${artist}`);
        })
        .catch((err) => {
          console.error('[useLastFmScrobbler] Error registrando scrobble:', err.message);
        });
    }
  }, [sessionState.currentTime, sessionState.isPlaying, sessionState.duration, metadata]);
}
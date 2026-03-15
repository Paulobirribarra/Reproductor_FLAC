// Interfaz para la sesión de audio
interface AudioSession {
  currentFile: {
    name: string;
    fullPath: string;
    path: string;
    size?: number;
  } | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playlist: any[];
  playlistIndex: number;
  volume: number;
}

// Estado del worker (persiste mientras el worker esté activo)
let audioSession: AudioSession = {
  currentFile: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playlist: [],
  playlistIndex: 0,
  volume: 1,
};

// Instancia del filePreloadWorker
let preloadWorker: Worker | null = null;

// Escuchar mensajes desde el main thread
self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  console.log(`[audioWorker] Comando recibido: ${type}`);

  switch (type) {
    case 'INITIALIZE':
      handleInitialize();
      break;

    case 'PLAY':
      handlePlay(payload);
      break;

    case 'PAUSE':
      handlePause();
      break;

    case 'SEEK':
      handleSeek(payload.time);
      break;

    case 'SET_VOLUME':
      handleSetVolume(payload.volume);
      break;

    case 'NEXT':
      handleNext();
      break;

    case 'PREV':
      handlePrevious();
      break;

    case 'SET_PLAYLIST':
      handleSetPlaylist(payload.playlist);
      break;

    case 'UPDATE_AUDIO_TIME':
      // El main thread envía actualización de tiempo
      audioSession.currentTime = payload.currentTime;
      broadcastState();
      break;

    case 'UPDATE_AUDIO_DURATION':
      // El main thread envía duración
      audioSession.duration = payload.duration;
      broadcastState();
      break;

    case 'AUDIO_ENDED':
      // El audio terminó, pasar al siguiente
      handleAudioEnded();
      break;

    case 'GET_STATE':
      broadcastState();
      break;

    default:
      console.warn(`[audioWorker] Comando desconocido: ${type}`);
  }
};

// ==================== HANDLERS ====================

function handleInitialize() {
  console.log('[audioWorker] Inicializado');
  
  // Crear instancia del filePreloadWorker
  if (!preloadWorker) {
    try {
      preloadWorker = new Worker(
        new URL('../workers/filePreloadWorker.ts', import.meta.url),
        { type: 'module' }
      );
      console.log('[audioWorker] filePreloadWorker creado');
    } catch (error) {
      console.warn('[audioWorker] No se pudo crear filePreloadWorker:', error);
    }
  }
  
  broadcastState();
}

function handlePlay(payload: { file: any; playlist?: any[] }) {
  const { file, playlist } = payload;

  if (playlist) {
    audioSession.playlist = playlist;
    audioSession.playlistIndex = playlist.findIndex(
      (f) => f.name === file.name && f.path === file.path
    );
  }

  playFile(file);
}

function playFile(file: any) {
  console.log(`[audioWorker] Reproduciendo: ${file.name}`);

  audioSession.currentFile = {
    name: file.name,
    fullPath: file.path,
    path: file.path,
    size: file.size || 0,
  };
  audioSession.currentTime = 0;
  audioSession.duration = 0;
  audioSession.isPlaying = true;

  // Extraer la carpeta de la ruta completa
  // Si file.path = "Devil Doll Eliogabalus\01. Mr. Doctor.flac", folder debe ser "Devil Doll Eliogabalus"
  let folderParam = '';
  if (file.path && file.path.includes('\\')) {
    const parts = file.path.split('\\');
    if (parts.length > 1) {
      // Remover el último elemento (nombre del archivo)
      folderParam = parts.slice(0, -1).join('\\');
    }
  } else if (file.path && file.path.includes('/')) {
    const parts = file.path.split('/');
    if (parts.length > 1) {
      // Remover el último elemento (nombre del archivo)
      folderParam = parts.slice(0, -1).join('/');
    }
  }

  const folderQuery = folderParam ? `&folder=${encodeURIComponent(folderParam)}` : '';
  const streamUrl = `/api/files/${encodeURIComponent(file.name)}/stream?${folderQuery}`;
  
  console.log(`[audioWorker] Stream URL: ${streamUrl}`);
  
  // Pedir al main thread que reproduzca el archivo
  self.postMessage({
    type: 'PLAY_FILE',
    payload: { file, streamUrl }
  });

  // Precargar el siguiente archivo si existe
  preloadNextFile();

  broadcastState();
}

function handlePause() {
  console.log('[audioWorker] Pausado');
  audioSession.isPlaying = false;
  
  // Pedir al main thread que pause
  self.postMessage({ type: 'PAUSE_AUDIO' });
  
  broadcastState();
}

function handleSeek(time: number) {
  console.log(`[audioWorker] Buscando a: ${time}s`);
  audioSession.currentTime = time;
  
  // Pedir al main thread que haga seek
  self.postMessage({
    type: 'SEEK_AUDIO',
    payload: { time }
  });
  
  broadcastState();
}

function handleSetVolume(volume: number) {
  console.log(`[audioWorker] Volumen: ${volume}`);
  audioSession.volume = Math.max(0, Math.min(1, volume));
  
  // Pedir al main thread que ajuste volumen
  self.postMessage({
    type: 'SET_AUDIO_VOLUME',
    payload: { volume: audioSession.volume }
  });
  
  broadcastState();
}

function handleNext() {
  if (audioSession.playlistIndex < audioSession.playlist.length - 1) {
    audioSession.playlistIndex++;
    const nextFile = audioSession.playlist[audioSession.playlistIndex];
    playFile(nextFile);
  }
}

function handlePrevious() {
  if (audioSession.playlistIndex > 0) {
    audioSession.playlistIndex--;
    const prevFile = audioSession.playlist[audioSession.playlistIndex];
    playFile(prevFile);
  }
}

function handleSetPlaylist(playlist: any[]) {
  console.log(`[audioWorker] Playlist actualizada: ${playlist.length} archivos`);
  audioSession.playlist = playlist;
}

function handleAudioEnded() {
  console.log('[audioWorker] Archivo terminó');
  audioSession.isPlaying = false;
  
  // Auto-play siguiente
  if (audioSession.playlistIndex < audioSession.playlist.length - 1) {
    audioSession.playlistIndex++;
    const nextFile = audioSession.playlist[audioSession.playlistIndex];
    playFile(nextFile);
  }
  
  broadcastState();
  self.postMessage({
    type: 'PLAYBACK_ENDED',
    payload: { nextIndex: audioSession.playlistIndex }
  });
}

// ==================== UTILITIES ====================

function broadcastState() {
  self.postMessage({
    type: 'STATE_UPDATE',
    payload: audioSession,
  });
}

/**
 * Precargar el siguiente archivo en la playlist
 */
function preloadNextFile() {
  if (!preloadWorker || audioSession.playlist.length === 0) {
    return;
  }

  const nextIndex = audioSession.playlistIndex + 1;
  if (nextIndex >= audioSession.playlist.length) {
    return; // No hay siguiente archivo
  }

  const nextFile = audioSession.playlist[nextIndex];
  if (!nextFile) {
    return;
  }

  try {
    console.log(`[audioWorker] Enviando precarga: ${nextFile.name}`);
    preloadWorker.postMessage({
      type: 'PRELOAD_FILE',
      payload: {
        name: nextFile.name,
        path: nextFile.path,
      },
    });
  } catch (error) {
    console.warn('[audioWorker] Error mandando precarga:', error);
  }
}

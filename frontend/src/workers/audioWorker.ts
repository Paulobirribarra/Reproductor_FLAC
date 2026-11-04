// Interfaz para la sesión de audio
interface AudioFile {
  name: string;
  fullPath?: string;
  path: string;
  size?: number;
}

interface AudioSession {
  currentFile: AudioFile | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playlist: AudioFile[];
  playlistIndex: number;
  volume: number;
}

// Estado del worker
let audioSession: AudioSession = {
  currentFile: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playlist: [],
  playlistIndex: 0,
  volume: 1,
};

let preloadWorker: Worker | null = null;

// ==================== FUNCIONES DE UTILIDAD ====================

function broadcastState() {
  self.postMessage({
    type: 'STATE_UPDATE',
    payload: audioSession,
  });
}

function extractFolderParam(filePath: string): string {
  if (!filePath) return '';
  const separator = filePath.includes('\\') ? '\\' : filePath.includes('/') ? '/' : null;
  if (!separator) return '';

  const parts = filePath.split(separator);
  return parts.length > 1 ? parts.slice(0, -1).join(separator) : '';
}

function buildStreamUrl(file: AudioFile): string {
  const folderParam = extractFolderParam(file.path || file.fullPath || '');
  const folderQuery = folderParam ? `folder=${encodeURIComponent(folderParam)}` : '';
  return `/api/files/${encodeURIComponent(file.name)}/stream${folderQuery ? '?' + folderQuery : ''}`;
}

// ==================== HANDLERS DE ACCIÓN ====================

const handleInitialize = () => {
  // PreloadWorker desactivado para evitar saturación de red innecesaria
  broadcastState();
};

const handlePlay = (payload: { file: AudioFile; playlist?: AudioFile[] }) => {
  const { file, playlist } = payload;

  if (playlist) {
    audioSession.playlist = playlist;
    audioSession.playlistIndex = playlist.findIndex(
      (f) => f.name === file.name && f.path === file.path
    );
  }

  playFile(file);
};

const playFile = (file: AudioFile) => {
  audioSession.currentFile = {
    name: file.name,
    fullPath: file.path || file.fullPath,
    path: file.path,
    size: file.size || 0,
  };
  audioSession.currentTime = 0;
  audioSession.duration = 0;
  audioSession.isPlaying = true;

  const streamUrl = buildStreamUrl(file);

  self.postMessage({
    type: 'PLAY_FILE',
    payload: { file, streamUrl },
  });

  preloadNextFile();
  broadcastState();
};

const handlePause = () => {
  audioSession.isPlaying = false;
  self.postMessage({ type: 'PAUSE_AUDIO' });
  broadcastState();
};

const handleResume = () => {
  if (!audioSession.currentFile) return;
  audioSession.isPlaying = true;
  self.postMessage({ type: 'RESUME_AUDIO' });
  broadcastState();
};

const handleStop = () => {
  audioSession.isPlaying = false;
  audioSession.currentTime = 0;
  self.postMessage({ type: 'STOP_AUDIO' });
  broadcastState();
};

const handleSeek = (time: number) => {
  audioSession.currentTime = time;
  self.postMessage({
    type: 'SEEK_AUDIO',
    payload: { time },
  });
  broadcastState();
};

const handleSetVolume = (volume: number) => {
  audioSession.volume = Math.max(0, Math.min(1, volume));
  self.postMessage({
    type: 'SET_AUDIO_VOLUME',
    payload: { volume: audioSession.volume },
  });
  broadcastState();
};

const handleNext = () => {
  if (audioSession.playlistIndex < audioSession.playlist.length - 1) {
    audioSession.playlistIndex++;
    playFile(audioSession.playlist[audioSession.playlistIndex]);
  }
};

const handlePrevious = () => {
  if (audioSession.playlistIndex > 0) {
    audioSession.playlistIndex--;
    playFile(audioSession.playlist[audioSession.playlistIndex]);
  }
};

const handleSetPlaylist = (playlist: AudioFile[]) => {
  audioSession.playlist = playlist;
};

const handleAudioEnded = () => {
  audioSession.isPlaying = false;

  if (audioSession.playlistIndex < audioSession.playlist.length - 1) {
    audioSession.playlistIndex++;
    playFile(audioSession.playlist[audioSession.playlistIndex]);
  }

  broadcastState();
  self.postMessage({
    type: 'PLAYBACK_ENDED',
    payload: { nextIndex: audioSession.playlistIndex },
  });
};

const preloadNextFile = () => {
  // Deshabilitado: el streaming directo nativo con Range Requests (RFC 7233)
  // es instantáneo y evita saturar el canal de red/Tailscale con descargas completas.
};

// ==================== DICCIONARIO DE COMANDOS ====================

const workerActions: Record<string, (payload: any) => void> = {
  'INITIALIZE': () => handleInitialize(),
  'PLAY': (payload) => handlePlay(payload),
  'PAUSE': () => handlePause(),
  'RESUME': () => handleResume(),
  'STOP': () => handleStop(),
  'SEEK': (payload) => handleSeek(payload.time),
  'SET_VOLUME': (payload) => handleSetVolume(payload.volume),
  'NEXT': () => handleNext(),
  'PREV': () => handlePrevious(),
  'SET_PLAYLIST': (payload) => handleSetPlaylist(payload.playlist),
  'UPDATE_AUDIO_TIME': (payload) => {
    audioSession.currentTime = payload.currentTime;
    broadcastState();
  },
  'UPDATE_AUDIO_DURATION': (payload) => {
    audioSession.duration = payload.duration;
    broadcastState();
  },
  'AUDIO_ENDED': () => handleAudioEnded(),
  'GET_STATE': () => broadcastState(),
  'AUDIO_ERROR': (payload) => {
    console.warn('[audioWorker] Received AUDIO_ERROR:', payload);
    // Forward a generic error message to UI so it can display a toast
    self.postMessage({ type: 'PLAYBACK_ERROR', payload: { error: payload.error } });
  },
};

// ==================== EVENT LISTENER PRINCIPAL ====================

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;
  const action = workerActions[type];

  if (action) {
    action(payload);
  } else {
    console.warn(`[audioWorker] Comando desconocido: ${type}`);
  }
};
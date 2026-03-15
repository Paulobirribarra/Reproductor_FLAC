# Guía de Implementación - Web Workers

## 📋 Resumen

Esta guía te llevará paso a paso a través de la implementación de Web Workers para mantener la reproducción de audio persistente, independientemente de los cambios de navegación en la app.

---

## 🎯 Objetivos

✅ Reproducción de audio que NO se detiene al navegar  
✅ Sesión independiente del ciclo React  
✅ Comunicación limpia entre Worker y UI  
✅ Estado sincronizado con Zustand  

---

## 📂 Estructura que Crearemos

```
frontend/src/
├── workers/
│   ├── audioWorker.ts       ← Crea esta
│   └── filePreloadWorker.ts ← Crea esta (opcional por ahora)
├── hooks/
│   └── useAudioWorker.ts    ← Crea esta
├── store/
│   ├── playerStore.ts       ← Actualizar
│   ├── filesStore.ts        ← No cambiar
│   └── workerStore.ts       ← Crea esta (NEW)
└── App.tsx                  ← Actualizar
```

---

## 🚀 Paso 1: Crear audioWorker.ts

### **Archivo: frontend/src/workers/audioWorker.ts**

```typescript
// Interfaz para la sesión de audio
interface AudioSession {
  currentFile: {
    name: string;
    fullPath: string;
    path: string;
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

// Crear elemento de audio
const audio = new Audio();

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

  // Configurar event listeners del audio
  audio.addEventListener('timeupdate', () => {
    audioSession.currentTime = audio.currentTime;
    broadcastState();
  });

  audio.addEventListener('loadedmetadata', () => {
    audioSession.duration = audio.duration;
    broadcastState();
  });

  audio.addEventListener('ended', () => {
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
  });

  audio.addEventListener('play', () => {
    audioSession.isPlaying = true;
    broadcastState();
  });

  audio.addEventListener('pause', () => {
    audioSession.isPlaying = false;
    broadcastState();
  });

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
  };
  audioSession.currentTime = 0;
  audioSession.duration = 0;

  // Construir URL del stream
  const streamUrl = `/api/files/${encodeURIComponent(file.name)}/stream?folder=${file.path}`;
  audio.src = streamUrl;
  audio.load();

  // Reproducir después de cargar metadatos
  setTimeout(() => {
    audio.play().catch((error) => {
      console.error('[audioWorker] Error reproduciendo:', error);
      audioSession.isPlaying = false;
      broadcastState();
    });
  }, 100);

  broadcastState();
}

function handlePause() {
  console.log('[audioWorker] Pausado');
  audio.pause();
  audioSession.isPlaying = false;
  broadcastState();
}

function handleSeek(time: number) {
  console.log(`[audioWorker] Buscando a: ${time}s`);
  audio.currentTime = time;
  audioSession.currentTime = time;
  broadcastState();
}

function handleSetVolume(volume: number) {
  console.log(`[audioWorker] Volumen: ${volume}`);
  audio.volume = Math.max(0, Math.min(1, volume));
  audioSession.volume = audio.volume;
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

// ==================== UTILITIES ====================

function broadcastState() {
  self.postMessage({
    type: 'STATE_UPDATE',
    payload: audioSession,
  });
}
```

---

## 🪝 Paso 2: Crear useAudioWorker Hook

### **Archivo: frontend/src/hooks/useAudioWorker.ts**

```typescript
import { useRef, useEffect, useCallback } from 'react';
import type { FileInfo } from '../types/index';

interface AudioSession {
  currentFile: any | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playlist: any[];
  playlistIndex: number;
  volume: number;
}

export const useAudioWorker = (onFileEnded?: () => void) => {
  const workerRef = useRef<Worker | null>(null);
  const [sessionState, setSessionState] = useStateFromWorker();

  // Inicializar worker
  useEffect(() => {
    if (workerRef.current) return; // Evitar duplicados

    try {
      workerRef.current = new Worker(
        new URL('../workers/audioWorker.ts', import.meta.url),
        { type: 'module' }
      );

      const handleMessage = (event: MessageEvent) => {
        const { type, payload } = event.data;

        if (type === 'STATE_UPDATE') {
          setSessionState(payload);
        } else if (type === 'PLAYBACK_ENDED') {
          console.log('[useAudioWorker] Playback ended');
          onFileEnded?.();
        } else if (type === 'DEBUG_LOG') {
          console.log(`[Worker] ${payload}`);
        }
      };

      workerRef.current.addEventListener('message', handleMessage);

      // Inicializar worker
      workerRef.current.postMessage({ type: 'INITIALIZE' });

      return () => {
        workerRef.current?.removeEventListener('message', handleMessage);
      };
    } catch (error) {
      console.error('[useAudioWorker] Error inicializando:', error);
    }
  }, []);

  // Métodos públicos
  const play = useCallback((file: FileInfo, playlist: FileInfo[] = []) => {
    workerRef.current?.postMessage({
      type: 'PLAY',
      payload: { file, playlist },
    });
  }, []);

  const pause = useCallback(() => {
    workerRef.current?.postMessage({ type: 'PAUSE' });
  }, []);

  const seek = useCallback((time: number) => {
    workerRef.current?.postMessage({
      type: 'SEEK',
      payload: { time },
    });
  }, []);

  const setVolume = useCallback((volume: number) => {
    workerRef.current?.postMessage({
      type: 'SET_VOLUME',
      payload: { volume },
    });
  }, []);

  const next = useCallback(() => {
    workerRef.current?.postMessage({ type: 'NEXT' });
  }, []);

  const prev = useCallback(() => {
    workerRef.current?.postMessage({ type: 'PREV' });
  }, []);

  const setPlaylist = useCallback((playlist: FileInfo[]) => {
    workerRef.current?.postMessage({
      type: 'SET_PLAYLIST',
      payload: { playlist },
    });
  }, []);

  const getState = useCallback(() => {
    workerRef.current?.postMessage({ type: 'GET_STATE' });
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
  };
};

// Custom hook para manejar estado desde worker
function useStateFromWorker() {
  const [state, setState] = React.useState<AudioSession>({
    currentFile: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playlist: [],
    playlistIndex: 0,
    volume: 1,
  });

  return [state, setState] as const;
}
```

⚠️ **Error en el código anterior** - necesitamos React:

```typescript
import React from 'react';
```

---

## 📦 Paso 3: Crear workerStore.ts

### **Archivo: frontend/src/store/workerStore.ts**

```typescript
import { create } from 'zustand';
import type { FileInfo } from '../types/index';

interface AudioSession {
  currentFile: FileInfo | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playlist: FileInfo[];
  playlistIndex: number;
  volume: number;
}

interface WorkerStore {
  // Estado
  audioSession: AudioSession;
  setAudioSession: (session: AudioSession) => void;

  // Acciones
  initializeWorker: () => void;
  play: (file: FileInfo, playlist?: FileInfo[]) => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  next: () => void;
  prev: () => void;

  // Worker
  worker: Worker | null;
  setWorker: (worker: Worker) => void;
}

export const useWorkerStore = create<WorkerStore>((set, get) => ({
  audioSession: {
    currentFile: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playlist: [],
    playlistIndex: 0,
    volume: 1,
  },

  setAudioSession: (session) => set({ audioSession: session }),

  worker: null,
  setWorker: (worker) => set({ worker }),

  initializeWorker: () => {
    const { worker } = get();
    if (worker) {
      worker.postMessage({ type: 'INITIALIZE' });
    }
  },

  play: (file, playlist = []) => {
    const { worker } = get();
    if (worker) {
      worker.postMessage({
        type: 'PLAY',
        payload: { file, playlist },
      });
    }
  },

  pause: () => {
    const { worker } = get();
    if (worker) {
      worker.postMessage({ type: 'PAUSE' });
    }
  },

  seek: (time) => {
    const { worker } = get();
    if (worker) {
      worker.postMessage({ type: 'SEEK', payload: { time } });
    }
  },

  setVolume: (volume) => {
    const { worker } = get();
    if (worker) {
      worker.postMessage({ type: 'SET_VOLUME', payload: { volume } });
    }
  },

  next: () => {
    const { worker } = get();
    if (worker) {
      worker.postMessage({ type: 'NEXT' });
    }
  },

  prev: () => {
    const { worker } = get();
    if (worker) {
      worker.postMessage({ type: 'PREV' });
    }
  },
}));
```

---

## 🔗 Paso 4: Actualizar App.tsx

### **Cambios en App.tsx**

1. Importar el hook y store:
```typescript
import { useWorkerStore } from './store/workerStore';
import { useAudioWorker } from './hooks/useAudioWorker';
```

2. En el componente App, inicializar:
```typescript
function App() {
  const { play, pause, seek } = useWorkerStore();
  const { sessionState } = useAudioWorker();
  
  // ... resto del código
}
```

3. Usar en lugar de Player actual:
```typescript
// Antes de renderizar Player
{currentFile && (
  <div>
    <h2>Reproduciendo</h2>
    {/* Renderizar controles con sessionState */}
    <button onClick={() => play(currentFile)}>Play</button>
  </div>
)}
```

---

## ✅ Testing Manual

1. **Iniciar dev servers:**
   ```bash
   # Terminal 1
   cd backend && npm run dev
   
   # Terminal 2
   cd frontend && npm run dev
   ```

2. **Abrir DevTools (F12):**
   - Console → Deberías ver `[audioWorker] Inicializado`

3. **Cargar archivo FLAC** y reproducir

4. **Cambiar de carpeta** → ✅ La música DEBE continuar

5. **Verificar Workers:**
   - F12 → Sources → Threads
   - Deberías ver: Main + audioWorker

---

## 🐛 Troubleshooting

| Problema | Solución |
|----------|----------|
| `Failed to construct Worker` | Verifica el path en `new URL()` |
| `Worker is undefined` | Asegúrate que el archivo existe |
| `postMessage is not a function` | El worker no inicializó correctamente |
| `Audio no suena` | Verifica la URL de streaming en la consola |

---

## 📝 Próximos Pasos

1. ✅ Implementar audioWorker.ts
2. ✅ Crear useAudioWorker hook
3. ✅ Crear workerStore
4. ⏳ Actualizar App.tsx y Player.tsx para usar workers
5. ⏳ Testing completo
6. ⏳ Documentar resultados

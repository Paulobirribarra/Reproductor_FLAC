import { create } from 'zustand';
import type { FileInfo } from '../types/index';

export interface AudioSession {
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

  // Worker reference
  worker: Worker | null;
  setWorker: (worker: Worker) => void;

  // Acciones para comunicarse con el worker
  play: (file: FileInfo, playlist?: FileInfo[]) => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  next: () => void;
  prev: () => void;
  setPlaylist: (playlist: FileInfo[]) => void;
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

  setAudioSession: (session) => {
    set({ audioSession: session });
  },

  worker: null,
  setWorker: (worker) => {
    set({ worker });
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
      worker.postMessage({
        type: 'SEEK',
        payload: { time },
      });
    }
  },

  setVolume: (volume) => {
    const { worker } = get();
    if (worker) {
      worker.postMessage({
        type: 'SET_VOLUME',
        payload: { volume },
      });
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

  setPlaylist: (playlist) => {
    const { worker } = get();
    if (worker) {
      worker.postMessage({
        type: 'SET_PLAYLIST',
        payload: { playlist },
      });
    }
  },
}));

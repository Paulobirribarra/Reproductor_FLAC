import { create } from 'zustand';
import type { FileInfo, PlayerState } from '../types/index';

interface PlayerStore extends PlayerState {
  bufferProgress: number; // 0-100
  bufferedFile: string | null; // nombre del archivo precargado
  isBuffering: boolean;
  albumPanelOpen: boolean;
  setCurrentFile: (file: FileInfo | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setBufferProgress: (progress: number) => void;
  setBufferedFile: (fileName: string | null) => void;
  setIsBuffering: (buffering: boolean) => void;
  setAlbumPanelOpen: (open: boolean) => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  currentFile: null,
  bufferProgress: 0,
  bufferedFile: null,
  isBuffering: false,
  albumPanelOpen: false,
  setCurrentFile: (file) => set({ currentFile: file }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setBufferProgress: (bufferProgress) => set({ bufferProgress }),
  setBufferedFile: (bufferedFile) => set({ bufferedFile }),
  setIsBuffering: (isBuffering) => set({ isBuffering }),
  setAlbumPanelOpen: (albumPanelOpen) => set({ albumPanelOpen }),
}));

interface FilesStore {
  files: FileInfo[];
  folders: any[];
  isLoading: boolean;
  error: string | null;
  currentPath: string;
  setFiles: (files: FileInfo[]) => void;
  setFolders: (folders: any[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentPath: (path: string) => void;
  addFile: (file: FileInfo) => void;
  removeFile: (fileId: string) => void;
  updateFile: (fileId: string, updates: Partial<FileInfo>) => void;
}

export const useFilesStore = create<FilesStore>((set) => ({
  files: [],
  folders: [],
  isLoading: false,
  error: null,
  currentPath: '/',
  setFiles: (files) => set({ files }),
  setFolders: (folders) => set({ folders }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setCurrentPath: (currentPath) => set({ currentPath }),
  addFile: (file) => set((state) => ({ files: [...state.files, file] })),
  removeFile: (fileId) =>
    set((state) => ({
      files: state.files.filter((f) => f.id !== fileId),
    })),
  updateFile: (fileId, updates) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId ? { ...f, ...updates } : f
      ),
    })),
}));

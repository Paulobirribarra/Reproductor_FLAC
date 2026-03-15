import { usePlayerStore } from '../store/index';
import { filesApi } from '../services/api';
import type { FileInfo } from '../types/index';

export const usePreloader = () => {
  const bufferedFile = usePlayerStore((state) => state.bufferedFile);
  const setBufferedFile = usePlayerStore((state) => state.setBufferedFile);
  const setBufferProgress = usePlayerStore((state) => state.setBufferProgress);
  const setIsBuffering = usePlayerStore((state) => state.setIsBuffering);

  const preloadFile = async (file: FileInfo, currentPath: string = '') => {
    // Evitar precargar el mismo archivo dos veces
    if (bufferedFile === file.name) {
      return;
    }

    try {
      setIsBuffering(true);
      setBufferProgress(0);
      
      const fileUrl = filesApi.getFileStream(file.name, currentPath);
      
      // Crear una solicitud fetch para descargar en background
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Failed to preload');

      // Leer el archivo en chunks
      const reader = response.body?.getReader();
      if (!reader) return;

      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        receivedLength += value.length;
        const progress = (receivedLength / contentLength) * 100;
        setBufferProgress(Math.min(progress, 100));
      }

      setBufferedFile(file.name);
      setBufferProgress(100);
      setIsBuffering(false);
    } catch (error) {
      console.error('Error preloading file:', error);
      setBufferProgress(0);
      setBufferedFile(null);
      setIsBuffering(false);
    }
  };

  const preloadNextFile = (files: FileInfo[], currentFile: FileInfo, currentPath: string = '') => {
    const currentIndex = files.findIndex((f) => f.name === currentFile.name && f.path === currentFile.path);
    if (currentIndex !== -1 && currentIndex < files.length - 1) {
      const nextFile = files[currentIndex + 1];
      // Precarga asincrónica sin bloquear, con delay
      setTimeout(() => {
        preloadFile(nextFile, currentPath);
      }, 2000); // Esperar 2 segundos antes de precargar
    }
  };

  return { preloadFile, preloadNextFile };
};

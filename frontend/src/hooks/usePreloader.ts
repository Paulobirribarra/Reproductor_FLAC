import { usePlayerStore } from '../store/index';
import type { FileInfo } from '../types/index';

export const usePreloader = () => {
  const bufferedFile = usePlayerStore((state) => state.bufferedFile);
  const setBufferedFile = usePlayerStore((state) => state.setBufferedFile);

  /**
   * Notificar que se debe precargar un archivo
   * IMPORTANTE: Ahora usamos el audioWorker + filePreloadWorker para precarga optimizada
   * ya no descargamos aquí en el navegador (evita ERR_INSUFFICIENT_RESOURCES)
   */
  const preloadFile = async (file: FileInfo, currentPath: string = '') => {
    // Solo registrar que se notificó precarga
    // El audioWorker ya está manejando filePreloadWorker
    if (bufferedFile !== file.name) {
      setBufferedFile(file.name);
      console.log(`[usePreloader] Preload notificado para: ${file.name} (optimizado por audioWorker)`);
    }
  };

  /**
   * Llamar a preloadFile para el siguiente archivo
   */
  const preloadNextFile = (files: FileInfo[], currentFile: FileInfo, currentPath: string = '') => {
    const currentIndex = files.findIndex((f) => f.name === currentFile.name && f.path === currentFile.path);
    if (currentIndex !== -1 && currentIndex < files.length - 1) {
      const nextFile = files[currentIndex + 1];
      // El audioWorker ya está manejando la precarga automáticamente
      // Solo notificamos para UI (buffering indicator)
      setTimeout(() => {
        preloadFile(nextFile, currentPath);
      }, 1000);
    }
  };

  return { preloadFile, preloadNextFile };
};

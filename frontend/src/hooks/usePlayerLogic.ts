import { useEffect, useCallback } from 'react';
import { usePlayerStore, useFilesStore } from '../store/index';
import { useWorkerStore } from '../store/workerStore';

export const usePlayerLogic = (
  files: any[],
  currentPath: string,
  preloadNextFile: (files: any[], currentFile: any, currentPath: string) => void
) => {
  const currentFile = usePlayerStore((state) => state.currentFile);
  const setCurrentFile = usePlayerStore((state) => state.setCurrentFile);
  const { audioSession } = useWorkerStore();

  // Pasar al siguiente archivo cuando termina el actual
  const handleFileEnded = useCallback(() => {
    if (!audioSession.currentFile || files.length === 0) return;

    const currentIndex = files.findIndex(
      (f) => f.name === audioSession.currentFile?.name && f.path === audioSession.currentFile?.path
    );
    
    if (currentIndex !== -1 && currentIndex < files.length - 1) {
      const nextFile = files[currentIndex + 1];
      setCurrentFile(nextFile);
    }
  }, [audioSession.currentFile, files, setCurrentFile]);

  // Precargar siguiente archivo cuando se cambia el actual
  useEffect(() => {
    if (currentFile && files.length > 0) {
      preloadNextFile(files, currentFile, currentPath);
    }
  }, [currentFile, files, currentPath, preloadNextFile]);

  return { handleFileEnded };
};

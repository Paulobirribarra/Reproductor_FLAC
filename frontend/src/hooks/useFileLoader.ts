import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFilesStore } from '../store/index';
import { filesApi } from '../services/api';

export const useFileLoader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const lastLoadedPathRef = useRef<string | null>(null);
  
  const files = useFilesStore((state) => state.files);
  const setFiles = useFilesStore((state) => state.setFiles);
  const setFolders = useFilesStore((state) => state.setFolders);
  const currentPath = useFilesStore((state) => state.currentPath);
  const setCurrentPath = useFilesStore((state) => state.setCurrentPath);
  const error = useFilesStore((state) => state.error);

  const loadFiles = useCallback(async (path: string = '') => {
    const normalizedPath = path.replace(/\\/g, '/');
    
    // Evitar recargar la misma ruta
    if (lastLoadedPathRef.current === normalizedPath) {
      console.log(`[useFileLoader] Ruta ya cargada: ${normalizedPath}, ignorando...`);
      return;
    }
    
    try {
      console.log(`[useFileLoader] Cargando archivos desde: "${normalizedPath || 'raíz'}"`);
      
      lastLoadedPathRef.current = normalizedPath;
      
      const response = await filesApi.listFiles(normalizedPath);
      if (response.data.success && response.data.data) {
        console.log(`[useFileLoader] Respuesta recibida:`, response.data.data);
        setFiles(response.data.data.files);
        setFolders(response.data.data.folders || []);
        setCurrentPath(normalizedPath);
        
        // Solo navegar si la URL actual es diferente
        const expectedPathname = normalizedPath 
          ? `/folder/${encodeURIComponent(normalizedPath)}`
          : '/';
        
        if (location.pathname !== expectedPathname) {
          navigate(expectedPathname, { replace: true });
        }
      }
    } catch (error) {
      console.error('[useFileLoader] Error al cargar archivos:', error);
    }
  }, [setFiles, setFolders, setCurrentPath, navigate, location.pathname]);

  // Sincronizar con cambios de URL
  useEffect(() => {
    let pathFromUrl = location.pathname.startsWith('/folder/')
      ? decodeURIComponent(location.pathname.replace('/folder/', ''))
      : '';
    
    pathFromUrl = pathFromUrl.replace(/\\/g, '/');
    
    // Solo cargar si es diferente a la última ruta cargada
    if (pathFromUrl !== lastLoadedPathRef.current) {
      console.log(`[useFileLoader] URL cambió: ${pathFromUrl}, cargando...`);
      loadFiles(pathFromUrl);
    }
  }, [location.pathname, loadFiles]);

  return {
    files,
    currentPath,
    error,
    loadFiles
  };
};

import React, { useRef, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import Swal from 'sweetalert2';
import { useFilesStore } from '../../store/index';
import { filesApi } from '../../services/api';
import type { FileInfo } from '../../types/index';
import { AlphabetIndex } from './AlphabetIndex';
import { FolderCard, type FolderItem } from '../Library/FolderCard';
import { TrackItem } from '../Library/TrackItem';
import { MediaGallery } from '../Library/MediaGallery';

interface MainContentProps {
  files: FileInfo[];
  folders?: FolderItem[];
  onPlay: (file: FileInfo) => void;
  onFolderClick?: (folderPath: string) => void;
  onFileUpdated: () => void;
  onAddToPlaylist?: (file: FileInfo) => void;
  error?: string | null;
}

export const MainContent: React.FC<MainContentProps> = ({
  files,
  folders = [],
  onPlay,
  onFolderClick,
  onFileUpdated,
  onAddToPlaylist,
  error,
}) => {
  const currentPath = useFilesStore((state) => state.currentPath);
  const searchQuery = useFilesStore((state) => state.searchQuery);
  const setSearchQuery = useFilesStore((state) => state.setSearchQuery);
  const scrollPositions = useFilesStore((state) => state.scrollPositions);
  const saveScrollPosition = useFilesStore((state) => state.saveScrollPosition);

  const containerRef = useRef<HTMLElement>(null);
  const [activeLetter, setActiveLetter] = useState<string>('');

  // Restaurar la posición de scroll al cambiar de carpeta o cargar elementos
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const savedPos = scrollPositions[currentPath] || 0;
    containerRef.current.scrollTop = savedPos;
  }, [currentPath, files, folders, scrollPositions]);

  // Manejador al hacer clic en una carpeta (guarda scroll antes de entrar)
  const handleFolderNavigation = useCallback(
    (folderPath: string) => {
      if (containerRef.current) {
        saveScrollPosition(currentPath, containerRef.current.scrollTop);
      }
      onFolderClick?.(folderPath);
    },
    [currentPath, saveScrollPosition, onFolderClick]
  );

  // Manejar salto rápido alfabético
  const handleSelectLetter = useCallback((letter: string) => {
    setActiveLetter(letter);
    const targetElement = document.getElementById(`letter-group-${letter}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Filtrar carpetas y archivos localmente por búsqueda
  const filteredFolders = useMemo(
    () =>
      folders.filter((folder) =>
        folder.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [folders, searchQuery]
  );

  const filteredFiles = useMemo(
    () =>
      files.filter((file) =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [files, searchQuery]
  );

  const isAudioFile = (name: string) =>
    /\.(flac|mp3|wav|ogg|m4a|ape|wv|wma)$/i.test(name);
  const isImageFile = (name: string) =>
    /\.(jpg|jpeg|png|bmp|gif)$/i.test(name);

  const audioFiles = useMemo(
    () => filteredFiles.filter((file) => isAudioFile(file.name)),
    [filteredFiles]
  );
  const imageFiles = useMemo(
    () => filteredFiles.filter((file) => isImageFile(file.name)),
    [filteredFiles]
  );
  const otherFiles = useMemo(
    () =>
      filteredFiles.filter(
        (file) => !isAudioFile(file.name) && !isImageFile(file.name)
      ),
    [filteredFiles]
  );

  const totalFilteredItems = filteredFiles.length + filteredFolders.length;
  const isSearching = searchQuery.length > 0;

  // Descargar carpeta completa en ZIP
  const handleDownloadFolder = (folderPath: string, folderName?: string) => {
    const url = filesApi.getDownloadFolderUrl(folderPath);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${folderName || 'Carpeta'}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Descargar archivo individual
  const handleDownloadFile = (e: React.MouseEvent, file: FileInfo) => {
    e.stopPropagation();
    const folderPath = file.path
      ? file.path.split('/').slice(0, -1).join('/')
      : currentPath;
    const url = filesApi.getDownloadUrl(file.name, folderPath);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Eliminar archivo con confirmación
  const handleDeleteFile = async (e: React.MouseEvent, file: FileInfo) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: '¿Eliminar archivo?',
      text: `¿Estás seguro de que deseas eliminar "${file.name}"? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#18181b',
      color: '#f4f4f5',
    });

    if (result.isConfirmed) {
      try {
        const folderPath = file.path
          ? file.path.split('/').slice(0, -1).join('/')
          : currentPath;
        await filesApi.deleteFile(file.name, folderPath);
        Swal.fire({
          title: 'Eliminado',
          text: `"${file.name}" ha sido eliminado`,
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          background: '#18181b',
          color: '#f4f4f5',
        });
        onFileUpdated();
      } catch (err: any) {
        console.error('Error eliminando archivo:', err);
        Swal.fire({
          title: 'Error',
          text: err.response?.data?.error || 'No se pudo eliminar el archivo',
          icon: 'error',
          background: '#18181b',
          color: '#f4f4f5',
        });
      }
    }
  };

  // Eliminar carpeta completa con confirmación
  const handleDeleteFolder = async (e: React.MouseEvent, folder: FolderItem) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: '¿Eliminar carpeta completa?',
      text: `Se eliminará la carpeta "${folder.name}" y todos sus archivos.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Sí, eliminar carpeta',
      cancelButtonText: 'Cancelar',
      background: '#18181b',
      color: '#f4f4f5',
    });

    if (result.isConfirmed) {
      try {
        await filesApi.deleteFolder(folder.path);
        Swal.fire({
          title: 'Carpeta eliminada',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          background: '#18181b',
          color: '#f4f4f5',
        });
        onFileUpdated();
      } catch (err: any) {
        console.error('Error eliminando carpeta:', err);
        Swal.fire({
          title: 'Error',
          text: err.response?.data?.error || 'No se pudo eliminar la carpeta',
          icon: 'error',
          background: '#18181b',
          color: '#f4f4f5',
        });
      }
    }
  };

  return (
    <main
      ref={containerRef}
      className="flex-1 overflow-y-auto bg-transparent px-6 py-6 scroll-smooth pb-36"
    >
      {/* Header Info & Actions */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            📚 Tu Biblioteca
          </h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            {isSearching
              ? `Encontrados: ${filteredFolders.length} carpetas • ${filteredFiles.length} archivos`
              : files.length + folders.length === 0
              ? 'Sin elementos'
              : `${folders.length} álbumes/carpetas • ${files.length} archivos`}
          </p>
        </div>

        {/* Buscador y Descarga ZIP */}
        <div className="flex flex-wrap items-center gap-2.5">
          {currentPath && files.length > 0 && (
            <button
              onClick={() =>
                handleDownloadFolder(
                  currentPath,
                  currentPath.split('/').pop() || 'Biblioteca'
                )
              }
              className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-xl text-xs font-medium transition-all duration-200 flex items-center gap-1.5"
              title="Descargar todos los archivos de esta carpeta en un .zip"
            >
              <span>📦</span>
              <span>Descargar Carpeta (.zip)</span>
            </button>
          )}

          <div className="relative w-full md:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">
              🔍
            </span>
            <input
              type="text"
              placeholder="Buscar en esta carpeta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl py-1.5 pl-8 pr-8 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-xs"
            />
            {isSearching && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mensaje de error si ocurre */}
      {error && (
        <div className="mb-6 p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl text-red-200 text-xs">
          ⚠️ {error}
        </div>
      )}

      {/* Estado Vacío */}
      {totalFilteredItems === 0 ? (
        <div className="flex flex-col items-center justify-center h-80 text-center">
          <div className="text-5xl mb-3 opacity-30">
            {isSearching ? '🔎' : '🎵'}
          </div>
          <p className="text-zinc-400 text-sm font-medium mb-1">
            {isSearching
              ? 'No se encontraron resultados'
              : 'Tu biblioteca está vacía'}
          </p>
          <p className="text-zinc-600 text-xs">
            {isSearching
              ? 'Intenta con otros términos de búsqueda'
              : 'Sube archivos usando el botón superior'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Sección de Carpetas / Álbumes */}
          {filteredFolders.length > 0 && (
            <div>
              <AlphabetIndex
                items={filteredFolders}
                onSelectLetter={handleSelectLetter}
                activeLetter={activeLetter}
              />

              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3.5 flex items-center gap-2">
                📁 Álbumes y Carpetas{' '}
                {isSearching && (
                  <span className="text-blue-400 normal-case font-normal">
                    (filtrado)
                  </span>
                )}
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                {(() => {
                  const markedLetters = new Set<string>();

                  return filteredFolders.map((folder) => {
                    const firstChar = (folder.name[0] || '').toUpperCase();
                    const letterGroup = /[A-Z]/.test(firstChar) ? firstChar : '#';
                    let attachId = false;

                    if (!markedLetters.has(letterGroup)) {
                      markedLetters.add(letterGroup);
                      attachId = true;
                    }

                    return (
                      <FolderCard
                        key={folder.path}
                        id={attachId ? `letter-group-${letterGroup}` : undefined}
                        folder={folder}
                        onNavigate={handleFolderNavigation}
                        onDownload={handleDownloadFolder}
                        onDelete={handleDeleteFolder}
                      />
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Sección de Pistas de Audio */}
          {audioFiles.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                🎵 Pistas de Audio ({audioFiles.length}){' '}
                {isSearching && (
                  <span className="text-blue-400 normal-case font-normal">
                    (filtrado)
                  </span>
                )}
              </h3>
              <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-1 divide-y divide-zinc-900/60">
                {audioFiles.map((file, idx) => (
                  <TrackItem
                    key={file.id}
                    file={file}
                    index={idx}
                    onPlay={onPlay}
                    onDownload={handleDownloadFile}
                    onDelete={handleDeleteFile}
                    onAddToPlaylist={onAddToPlaylist}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Otros archivos (.cue, .log, etc.) */}
          {otherFiles.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                📄 Metadatos y Documentos (.cue, .log){' '}
                {isSearching && (
                  <span className="text-blue-400 normal-case font-normal">
                    (filtrado)
                  </span>
                )}
              </h3>
              <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-1 divide-y divide-zinc-900/60">
                {otherFiles.map((file, idx) => (
                  <TrackItem
                    key={file.id}
                    file={file}
                    index={idx}
                    onPlay={onPlay}
                    onDownload={handleDownloadFile}
                    onDelete={handleDeleteFile}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Galería de imágenes / carátulas */}
          <MediaGallery
            images={imageFiles}
            folderPath={currentPath}
            onDownload={handleDownloadFile}
            onDelete={handleDeleteFile}
          />
        </div>
      )}
    </main>
  );
};

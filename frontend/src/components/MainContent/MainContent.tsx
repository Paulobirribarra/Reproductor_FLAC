import React from 'react';
import Swal from 'sweetalert2';
import { useFilesStore } from '../../store/index';
import { filesApi } from '../../services/api';
import type { FileInfo } from '../../types/index';

interface Folder {
  name: string;
  path: string;
  coverImage?: string;
}

interface MainContentProps {
  files: FileInfo[];
  folders?: Folder[];
  onPlay: (file: FileInfo) => void;
  onFolderClick?: (folderPath: string) => void;
  onFileUpdated: () => void;
  error?: string | null;
}

export const MainContent: React.FC<MainContentProps> = ({
  files,
  folders = [],
  onPlay,
  onFolderClick,
  onFileUpdated,
  error
}) => {
  const currentPath = useFilesStore((state) => state.currentPath);
  const searchQuery = useFilesStore((state) => state.searchQuery);
  const setSearchQuery = useFilesStore((state) => state.setSearchQuery);

  // Filtrar carpetas y archivos localmente
  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAudioFile = (name: string) => /\.(flac|mp3|wav|ogg|m4a|ape|wv|wma)$/i.test(name);
  const isImageFile = (name: string) => /\.(jpg|jpeg|png|bmp|gif)$/i.test(name);

  const audioFiles = filteredFiles.filter(file => isAudioFile(file.name));
  const imageFiles = filteredFiles.filter(file => isImageFile(file.name));
  const otherFiles = filteredFiles.filter(file => !isAudioFile(file.name) && !isImageFile(file.name));

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
    const folderPath = file.path ? file.path.split('/').slice(0, -1).join('/') : currentPath;
    const url = filesApi.getDownloadUrl(file.name, folderPath);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Eliminar archivo
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
        const folderPath = file.path ? file.path.split('/').slice(0, -1).join('/') : currentPath;
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

  // Eliminar carpeta
  const handleDeleteFolder = async (e: React.MouseEvent, folder: Folder) => {
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
    <main className="flex-1 overflow-y-auto bg-zinc-950 px-6 py-6">
      {/* Header Info & Actions */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">📚 Tu Biblioteca</h2>
          <p className="text-zinc-400 text-sm">
            {isSearching
              ? `Encontrados: ${filteredFolders.length} carpeta${filteredFolders.length !== 1 ? 's' : ''} • ${filteredFiles.length} archivo${filteredFiles.length !== 1 ? 's' : ''}`
              : (files.length + folders.length === 0 ? 'Sin elementos' : `${folders.length} carpeta${folders.length !== 1 ? 's' : ''} • ${files.length} archivo${files.length !== 1 ? 's' : ''}`)
            }
          </p>
        </div>

        {/* Search Input & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Botón de descargar carpeta actual en ZIP si no está vacía */}
          {files.length > 0 && (
            <button
              onClick={() => handleDownloadFolder(currentPath, currentPath.split('/').pop() || 'Biblioteca')}
              className="px-3.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/40 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 shadow-sm"
              title="Descargar todos los archivos de esta carpeta en un archivo .zip"
            >
              <span>📦</span>
              <span>Descargar Carpeta (.zip)</span>
            </button>
          )}

          <div className="relative w-full md:w-72">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">🔍</span>
            <input
              type="text"
              placeholder="Buscar en esta carpeta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-10 pr-10 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 text-sm"
            />
            {isSearching && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-100 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Empty State / No Results */}
      {totalFilteredItems === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <div className="text-6xl mb-4 opacity-30">{isSearching ? '🔎' : '🎵'}</div>
          <p className="text-zinc-400 text-lg mb-2">
            {isSearching ? 'No se encontraron resultados' : 'Tu biblioteca está vacía'}
          </p>
          <p className="text-zinc-500 text-sm">
            {isSearching
              ? 'Intenta con otros términos de búsqueda'
              : 'Sube archivos usando el botón de arriba'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Folders Section */}
          {filteredFolders.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                📁 Carpetas {isSearching && <span className="text-blue-500 normal-case font-normal">(filtrado)</span>}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 md:gap-6">
                {filteredFolders.map((folder) => (
                  <div
                    key={folder.path}
                    className="flex flex-col gap-2 group relative"
                  >
                    <div 
                      onClick={() => onFolderClick?.(folder.path)}
                      className="relative w-full pt-[80%] rounded-lg overflow-visible flex items-end cursor-pointer"
                    >
                      {/* Parte trasera de la carpeta y pestaña */}
                      <div className="absolute top-0 left-0 w-[35%] h-[20%] bg-amber-600 rounded-t-lg"></div>
                      <div className="absolute top-[10%] left-0 w-full h-[90%] bg-amber-600 rounded-lg rounded-tl-none"></div>

                      {/* Imagen asomándose */}
                      {folder.coverImage ? (
                        <div className="absolute top-[12%] left-[5%] w-[90%] h-[80%] bg-zinc-800 rounded-md shadow-inner overflow-hidden transition-transform duration-300 group-hover:-translate-y-3">
                          <img
                            src={`/api/files/${encodeURIComponent(folder.coverImage.split('/').pop() || '')}/stream?folder=${encodeURIComponent(folder.coverImage.split('/').slice(0, -1).join('/'))}`}
                            alt={folder.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="absolute top-[12%] left-[5%] w-[90%] h-[80%] bg-zinc-800 rounded-md flex items-center justify-center shadow-inner transition-transform duration-300 group-hover:-translate-y-3">
                          <span className="text-4xl opacity-20">🎵</span>
                        </div>
                      )}

                      {/* Solapa delantera */}
                      <div className="absolute bottom-0 left-0 w-full h-[65%] bg-amber-400 rounded-lg shadow-lg border-t border-amber-300/30"></div>
                    </div>

                    {/* Botones de acción de carpeta en hover */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-zinc-900/90 rounded-lg p-1 shadow-lg border border-zinc-700">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadFolder(folder.path, folder.name);
                        }}
                        className="p-1 hover:bg-zinc-700 text-blue-400 rounded text-xs transition-colors"
                        title="Descargar carpeta en ZIP"
                      >
                        📦
                      </button>
                      <button
                        onClick={(e) => handleDeleteFolder(e, folder)}
                        className="p-1 hover:bg-zinc-700 text-red-400 rounded text-xs transition-colors"
                        title="Eliminar carpeta"
                      >
                        🗑️
                      </button>
                    </div>

                    <div 
                      onClick={() => onFolderClick?.(folder.path)}
                      className="text-center mt-2 px-1 cursor-pointer"
                    >
                      <p className="text-zinc-300 text-sm font-medium truncate group-hover:text-white transition-colors" title={folder.name}>
                        {folder.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audio Files Section */}
          {audioFiles.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                🎵 Pistas de Audio {isSearching && <span className="text-blue-500 normal-case font-normal">(filtrado)</span>}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {audioFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => onPlay(file)}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-800/60 hover:shadow-md cursor-pointer group flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="text-2xl group-hover:scale-110 transition-transform duration-200 flex-shrink-0">
                        🎵
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium text-sm truncate group-hover:text-blue-400 transition-colors duration-200" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-zinc-500 text-xs mt-0.5">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    {/* Botones de acción por archivo */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => handleDownloadFile(e, file)}
                        className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-blue-400 border border-zinc-700 transition-colors"
                        title="Descargar archivo"
                      >
                        ⬇️
                      </button>
                      <button
                        onClick={(e) => handleDeleteFile(e, file)}
                        className="p-1.5 rounded-md bg-zinc-800 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-800/60 transition-colors"
                        title="Eliminar archivo"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Otros archivos (.cue, .log, etc.) */}
          {otherFiles.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                📄 Otros Archivos (.cue, logs, etc.) {isSearching && <span className="text-blue-500 normal-case font-normal">(filtrado)</span>}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {otherFiles.map((file) => (
                  <div
                    key={file.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-800/60 flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="text-xl flex-shrink-0">
                        {file.name.toLowerCase().endsWith('.cue') ? '📋' : '📄'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-zinc-200 font-medium text-sm truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-zinc-500 text-xs mt-0.5">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => handleDownloadFile(e, file)}
                        className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-blue-400 border border-zinc-700 transition-colors"
                        title="Descargar archivo"
                      >
                        ⬇️
                      </button>
                      <button
                        onClick={(e) => handleDeleteFile(e, file)}
                        className="p-1.5 rounded-md bg-zinc-800 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-800/60 transition-colors"
                        title="Eliminar archivo"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Images Section */}
          {imageFiles.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                🖼️ Imágenes {isSearching && <span className="text-blue-500 normal-case font-normal">(filtrado)</span>}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 md:gap-6">
                {imageFiles.map((file) => {
                  const folderPath = file.path ? file.path.split('/').slice(0, -1).join('/') : currentPath;
                  const imageUrl = `/api/files/${encodeURIComponent(file.name)}/stream?folder=${encodeURIComponent(folderPath)}`;
                  return (
                    <div
                      key={file.id}
                      className="flex flex-col gap-2 group relative"
                    >
                      <div 
                        onClick={() => window.open(imageUrl, '_blank')}
                        className="relative w-full aspect-square rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 shadow-md cursor-pointer"
                      >
                        <img 
                          src={imageUrl} 
                          alt={file.name} 
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          loading="lazy"
                        />
                      </div>

                      {/* Botones de acción en imagen */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-zinc-900/90 rounded-lg p-1 shadow-lg border border-zinc-700">
                        <button
                          onClick={(e) => handleDownloadFile(e, file)}
                          className="p-1 hover:bg-zinc-700 text-blue-400 rounded text-xs transition-colors"
                          title="Descargar imagen"
                        >
                          ⬇️
                        </button>
                        <button
                          onClick={(e) => handleDeleteFile(e, file)}
                          className="p-1 hover:bg-zinc-700 text-red-400 rounded text-xs transition-colors"
                          title="Eliminar imagen"
                        >
                          🗑️
                        </button>
                      </div>

                      <div className="text-center px-1">
                        <p className="text-zinc-300 text-xs truncate group-hover:text-white transition-colors" title={file.name}>
                          {file.name}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
};

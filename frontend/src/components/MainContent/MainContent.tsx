import React from 'react';
import { useFilesStore } from '../../store/index';
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
  const searchQuery = useFilesStore((state) => state.searchQuery);
  const setSearchQuery = useFilesStore((state) => state.setSearchQuery);

  // Filtrar carpetas y archivos localmente
  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const audioFiles = filteredFiles.filter(file => !/\.(jpg|jpeg|png)$/i.test(file.name));
  const imageFiles = filteredFiles.filter(file => /\.(jpg|jpeg|png)$/i.test(file.name));

  const totalFilteredItems = filteredFiles.length + filteredFolders.length;
  const isSearching = searchQuery.length > 0;

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-950 px-6 py-6">
      {/* Header Info & Search Bar */}
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

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">🔍</span>
          <input
            type="text"
            placeholder="Buscar en esta carpeta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-10 pr-10 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
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
              : 'Sube archivos FLAC o MP3 usando el botón de arriba'}
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
                    onClick={() => onFolderClick?.(folder.path)}
                    className="flex flex-col gap-2 cursor-pointer group"
                  >
                    <div className="relative w-full pt-[80%] rounded-lg overflow-visible flex items-end">
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

                    <div className="text-center mt-2 px-1">
                      <p className="text-zinc-300 text-sm font-medium truncate group-hover:text-white transition-colors">
                        {folder.name}
                      </p>
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
                  const folderPath = file.path.split('/').slice(0, -1).join('/');
                  const imageUrl = `/api/files/${encodeURIComponent(file.name)}/stream?folder=${encodeURIComponent(folderPath)}`;
                  return (
                    <div
                      key={file.id}
                      onClick={() => window.open(imageUrl, '_blank')}
                      className="flex flex-col gap-2 cursor-pointer group"
                    >
                      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 shadow-md">
                        <img 
                          src={imageUrl} 
                          alt={file.name} 
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          loading="lazy"
                        />
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

          {/* Audio Files Section */}
          {audioFiles.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                🎵 Audio {isSearching && <span className="text-blue-500 normal-case font-normal">(filtrado)</span>}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {audioFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => onPlay(file)}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 transition-all duration-200 hover:border-zinc-600 hover:bg-zinc-800/50 hover:shadow-md cursor-pointer group"
                  >
                    <div className="flex gap-3">
                      <div className="text-2xl group-hover:scale-110 transition-transform duration-200">🎵</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold truncate group-hover:text-blue-400 transition-colors duration-200">
                          {file.name}
                        </p>
                        <p className="text-zinc-500 text-xs">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
};

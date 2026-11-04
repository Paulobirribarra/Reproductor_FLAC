import React from 'react';

export interface FolderItem {
  name: string;
  path: string;
  coverImage?: string;
  thumbUrl?: string;
}

interface FolderCardProps {
  folder: FolderItem;
  id?: string;
  onNavigate: (folderPath: string) => void;
  onDownload: (folderPath: string, folderName?: string) => void;
  onDelete: (e: React.MouseEvent, folder: FolderItem) => void;
}

export const FolderCard: React.FC<FolderCardProps> = ({
  folder,
  id,
  onNavigate,
  onDownload,
  onDelete,
}) => {
  // Priorizar el thumbnail WebP ultra ligero (~2-4 KB).
  // Si no está disponible, usar la URL construida para la ruta de la carpeta, con fallback a coverImage original
  const coverUrl = folder.thumbUrl 
    || `/api/covers/${folder.path.split('/').map(segment => encodeURIComponent(segment)).join('/')}`;

  return (
    <div
      id={id}
      className="flex flex-col gap-2 group relative scroll-mt-14 select-none"
    >
      {/* Contenedor tipo portada de disco / álbum */}
      <div
        onClick={() => onNavigate(folder.path)}
        className="relative w-full aspect-square rounded-2xl overflow-hidden cursor-pointer bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700/80 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-black/60 group-hover:-translate-y-1"
      >
        <img
          src={coverUrl}
          alt={folder.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            // Si falló el thumbnail y teníamos una imagen suelta original, intentamos esa
            if (folder.coverImage && !img.dataset.fallbackTried) {
              img.dataset.fallbackTried = 'true';
              img.src = `/uploads/${folder.coverImage.split('/').map(segment => encodeURIComponent(segment)).join('/')}`;
              return;
            }
            img.style.display = 'none';
            // Mostrar placeholder si la imagen falla
            const parent = img.parentElement;
            if (parent && !parent.querySelector('.folder-placeholder')) {
              const placeholder = document.createElement('div');
              placeholder.className = 'folder-placeholder w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-800/90 via-zinc-900 to-zinc-950 p-4 text-center';
              placeholder.innerHTML = `<span class="text-4xl opacity-30 group-hover:opacity-60 transition-opacity duration-300 mb-2">💿</span><span class="text-xs text-zinc-500 font-medium line-clamp-2 px-1">${folder.name}</span>`;
              parent.appendChild(placeholder);
            }
          }}
        />

        {/* Gradiente oscuro inferior para resaltar interacción */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Botón Play flotante al centro */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 group-hover:scale-100 pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-blue-600/95 text-white flex items-center justify-center shadow-xl shadow-blue-900/40 backdrop-blur-sm pl-0.5">
            <span className="text-lg">▶</span>
          </div>
        </div>

        {/* Acciones flotantes superiores (Descargar / Eliminar) */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 bg-zinc-950/80 backdrop-blur-md rounded-lg p-1 border border-zinc-800 shadow-md">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(folder.path, folder.name);
            }}
            className="p-1.5 hover:bg-zinc-800 text-zinc-300 hover:text-blue-400 rounded transition-colors text-xs"
            title="Descargar carpeta en ZIP"
          >
            📦
          </button>
          <button
            onClick={(e) => onDelete(e, folder)}
            className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 rounded transition-colors text-xs"
            title="Eliminar carpeta"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Título de la carpeta */}
      <div
        onClick={() => onNavigate(folder.path)}
        className="text-center px-1 cursor-pointer"
      >
        <p
          className="text-zinc-200 text-sm font-medium truncate group-hover:text-blue-400 transition-colors"
          title={folder.name}
        >
          {folder.name}
        </p>
      </div>
    </div>
  );
};

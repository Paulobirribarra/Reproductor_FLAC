import React from 'react';
import type { FileInfo } from '../../types/index';

interface MediaGalleryProps {
  images: FileInfo[];
  folderPath: string;
  onDownload: (e: React.MouseEvent, file: FileInfo) => void;
  onDelete: (e: React.MouseEvent, file: FileInfo) => void;
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({
  images,
  folderPath,
  onDownload,
  onDelete,
}) => {
  if (images.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        🖼️ Galería y Arte de Portada ({images.length})
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {images.map((file) => {
          const imagePath = folderPath ? `${folderPath}/${file.name}` : file.name;
          const imageUrl = `/uploads/${imagePath.split('/').map(segment => encodeURIComponent(segment)).join('/')}`;
          return (
            <div
              key={file.id}
              className="group relative flex flex-col gap-1.5"
            >
              <div
                onClick={() => window.open(imageUrl, '_blank')}
                className="relative w-full aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/80 shadow-md cursor-pointer hover:border-zinc-700 transition-all duration-200"
              >
                <img
                  src={imageUrl}
                  alt={file.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-xs text-white bg-black/60 px-2 py-1 rounded-md backdrop-blur-sm">
                    Ver completa ↗
                  </span>
                </div>
              </div>

              {/* Botones de acción flotantes */}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-zinc-950/80 backdrop-blur-md rounded-lg p-1 border border-zinc-800 shadow-md">
                <button
                  onClick={(e) => onDownload(e, file)}
                  className="p-1 hover:bg-zinc-800 text-zinc-300 hover:text-blue-400 rounded text-xs transition-colors"
                  title="Descargar imagen"
                >
                  ⬇️
                </button>
                <button
                  onClick={(e) => onDelete(e, file)}
                  className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 rounded text-xs transition-colors"
                  title="Eliminar imagen"
                >
                  🗑️
                </button>
              </div>

              <p
                className="text-zinc-400 text-[11px] truncate px-1 text-center group-hover:text-zinc-200 transition-colors"
                title={file.name}
              >
                {file.name}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

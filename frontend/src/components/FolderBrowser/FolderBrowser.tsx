import React from 'react';
import { useFilesStore } from '../../store/index';
import { filesApi } from '../../services/api';
import Swal from 'sweetalert2';
import type { FolderInfo } from '../../types/index';

interface FolderBrowserProps {
  onFolderNavigate: (path: string) => void;
}

export const FolderBrowser: React.FC<FolderBrowserProps> = ({ onFolderNavigate }) => {
  const currentPath = useFilesStore((state) => state.currentPath);
  const folders = useFilesStore((state) => state.folders);
  const setCurrentPath = useFilesStore((state) => state.setCurrentPath);

  const handleNavigateFolder = (folderPath: string) => {
    setCurrentPath(folderPath);
    onFolderNavigate(folderPath);
  };

  const handleGoBack = () => {
    const pathParts = currentPath.split('/').filter(Boolean);
    pathParts.pop();
    const parentPath = pathParts.length > 0 ? pathParts.join('/') : '';
    handleNavigateFolder(parentPath);
  };

  const handleDeleteFolder = async (folderPath: string, folderName: string) => {
    const result = await Swal.fire({
      title: '⚠️ Eliminar carpeta',
      text: `¿Estás seguro de que deseas eliminar la carpeta "${folderName}"?\n\nEsta acción eliminará toda la carpeta y su contenido.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      try {
        await filesApi.deleteFolder(folderPath);
        Swal.fire({
          title: '✅ Carpeta eliminada',
          text: `La carpeta "${folderName}" ha sido eliminada`,
          icon: 'success',
          timer: 2000,
        });
        onFolderNavigate(currentPath);
      } catch (error: any) {
        Swal.fire({
          title: '❌ Error',
          text: error.response?.data?.error || 'Error al eliminar la carpeta',
          icon: 'error',
        });
      }
    }
  };

  // Generar breadcrumbs
  const breadcrumbs = currentPath
    ? currentPath.split('/').filter(Boolean)
    : [];

  return (
    <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => handleNavigateFolder('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${currentPath === ''
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
        >
          🏠 Inicio
        </button>

        {breadcrumbs.map((crumb, index) => {
          const path = breadcrumbs.slice(0, index + 1).join('/');
          return (
            <React.Fragment key={path}>
              <span className="text-zinc-500">/</span>
              <button
                onClick={() => handleNavigateFolder(path)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${currentPath === path
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  }`}
              >
                {crumb}
              </button>
            </React.Fragment>
          );
        })}

        {currentPath && (
          <button
            onClick={handleGoBack}
            className="ml-auto px-3 py-1.5 bg-zinc-700 text-zinc-300 hover:bg-zinc-600 rounded-lg text-sm font-semibold transition-all duration-200"
            title="Ir a carpeta anterior"
          >
            ⬅️ Atrás
          </button>
        )}
      </div>

      {/* Carpetas */}
      {folders.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">📁 Carpetas</h3>
          <div className="space-y-2">
            {folders.map((folder: FolderInfo) => (
              <div
                key={folder.path}
                className="flex items-center justify-between p-3 bg-zinc-700 border border-zinc-600 rounded-lg hover:border-blue-500 hover:bg-zinc-700/50 transition-all duration-200 group"
              >
                <button
                  onClick={() => handleNavigateFolder(folder.path)}
                  className="flex-1 text-left text-white font-semibold group-hover:text-blue-400 transition-colors duration-200"
                >
                  📂 {folder.name}
                </button>
                <button
                  onClick={() => handleDeleteFolder(folder.path, folder.name)}
                  className="px-3 py-1.5 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded text-sm transition-all duration-200"
                  title="Eliminar carpeta"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {folders.length === 0 && (
        <p className="text-sm text-zinc-500 italic mt-2">No hay carpetas en esta ubicación</p>
      )}
    </div>
  );
};

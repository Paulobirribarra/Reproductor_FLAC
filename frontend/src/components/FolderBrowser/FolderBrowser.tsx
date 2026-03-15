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
    <div className="bg-gradient-to-r from-gray-100 to-gray-50 p-4 rounded-lg border-2 border-gray-300 mb-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => handleNavigateFolder('')}
          className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
            currentPath === ''
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          📁 Inicio
        </button>

        {breadcrumbs.map((crumb, index) => {
          const path = breadcrumbs.slice(0, index + 1).join('/');
          return (
            <React.Fragment key={path}>
              <span className="text-gray-500">/</span>
              <button
                onClick={() => handleNavigateFolder(path)}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                  currentPath === path
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
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
            className="ml-auto px-3 py-1 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded text-sm font-semibold transition-colors"
            title="Ir a carpeta anterior"
          >
            ⬅️ Atrás
          </button>
        )}
      </div>

      {/* Carpetas */}
      {folders.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-2">📁 Carpetas</h3>
          <div className="grid grid-cols-1 gap-2">
            {folders.map((folder: FolderInfo) => (
              <div
                key={folder.path}
                className="flex items-center justify-between p-2 bg-white border-2 border-gray-300 rounded hover:border-blue-400 transition-colors"
              >
                <button
                  onClick={() => handleNavigateFolder(folder.path)}
                  className="flex-1 text-left text-gray-900 font-semibold hover:text-blue-600"
                >
                  📂 {folder.name}
                </button>
                <button
                  onClick={() => handleDeleteFolder(folder.path, folder.name)}
                  className="px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-sm transition-colors"
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
        <p className="text-sm text-gray-600 italic">No hay carpetas en esta ubicación</p>
      )}
    </div>
  );
};

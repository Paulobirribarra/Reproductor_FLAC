import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { filesApi } from '../../services/api';

interface CreateFolderProps {
  onFolderCreated?: () => void;
  currentPath?: string;
}

export const CreateFolder: React.FC<CreateFolderProps> = ({ onFolderCreated, currentPath = '' }) => {
  const [folderName, setFolderName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateFolder = async () => {
    const trimmedName = folderName.trim();

    if (!trimmedName) {
      Swal.fire({
        title: 'Error',
        text: 'El nombre de la carpeta no puede estar vacío',
        icon: 'error',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    setIsLoading(true);

    try {
      await filesApi.createFolder(trimmedName, currentPath);
      Swal.fire({
        title: '✅ Carpeta creada',
        text: `La carpeta "${trimmedName}" ha sido creada correctamente`,
        icon: 'success',
        confirmButtonColor: '#3085d6',
      });
      setFolderName('');
      onFolderCreated?.();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Error al crear la carpeta';
      Swal.fire({
        title: '❌ Error',
        text: errorMsg,
        icon: 'error',
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 space-y-3">
      <label className="block text-sm font-semibold text-white">
        📁 Nombre de la carpeta
      </label>

      <div className="flex gap-2">
        <input
          type="text"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && folderName.trim() && !isLoading) {
              handleCreateFolder();
            }
          }}
          placeholder="Escribe el nombre..."
          disabled={isLoading}
          className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-white placeholder-zinc-400 focus:border-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-200"
        />
        <button
          onClick={handleCreateFolder}
          disabled={isLoading || !folderName.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white font-semibold rounded transition-all duration-200"
        >
          {isLoading ? '⏳ Creando...' : '➕ Crear'}
        </button>
      </div>
    </div>
  );
};

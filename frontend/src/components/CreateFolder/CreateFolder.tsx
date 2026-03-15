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
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border-2 border-blue-300">
      <label className="block text-sm font-bold text-blue-900 mb-3">
        📁 Crear Nueva Carpeta
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
          placeholder="Escribe el nombre de la carpeta"
          disabled={isLoading}
          className="flex-1 px-3 py-2 border-2 border-blue-300 rounded text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none disabled:bg-gray-200 disabled:cursor-not-allowed font-semibold"
        />
        <button
          onClick={handleCreateFolder}
          disabled={isLoading || !folderName.trim()}
          className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md"
        >
          {isLoading ? '⏳ Creando...' : '➕ Crear'}
        </button>
      </div>
    </div>
  );
};

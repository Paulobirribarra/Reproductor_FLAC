import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { usePlayerStore, useFilesStore } from '../../store/index';
import { filesApi } from '../../services/api';
import type { FileInfo } from '../../types/index';

interface FileItemProps {
  file: FileInfo;
  onPlay: (file: FileInfo) => void;
  onDelete: (fileId: string) => void;
  onRename: (fileId: string, newName: string) => void;
  onFileUpdated?: () => void;
}

export const FileItem: React.FC<FileItemProps> = ({ file, onPlay, onDelete, onRename, onFileUpdated }) => {
  const currentFile = usePlayerStore((state) => state.currentFile);
  const currentPath = useFilesStore((state) => state.currentPath);
  const isCurrentFile = currentFile?.id === file.id;
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(file.name);

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: '¿Eliminar archivo?',
      text: `¿Estás seguro de que deseas eliminar "${file.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      backdrop: true,
    });

    if (result.isConfirmed) {
      try {
        await filesApi.deleteFile(file.name, currentPath);
        onDelete(file.id);
        Swal.fire({
          title: 'Eliminado',
          text: 'El archivo ha sido eliminado correctamente',
          icon: 'success',
          timer: 2000,
          backdrop: true,
        });
      } catch (error) {
        console.error('Error al eliminar:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo eliminar el archivo',
          icon: 'error',
          backdrop: true,
        });
      }
    }
  };

  const handleRename = async () => {
    if (newName.trim() && newName !== file.name) {
      try {
        await filesApi.renameFile(file.name, newName, currentPath);
        onRename(file.id, newName);
        setIsRenaming(false);
        Swal.fire({
          title: 'Renombrado',
          text: `Archivo renombrado a "${newName}"`,
          icon: 'success',
          timer: 1500,
          backdrop: true,
        });
      } catch (error) {
        console.error('Error al renombrar:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo renombrar el archivo',
          icon: 'error',
          backdrop: true,
        });
      }
    } else {
      setIsRenaming(false);
    }
  };

  const handleMoveFile = async () => {
    const { value: targetFolder } = await Swal.fire({
      title: '📁 Mover archivo',
      input: 'text',
      inputLabel: 'Carpeta destino (ej: Música/Rock)',
      inputValue: '',
      inputPlaceholder: 'Deja vacío para mover a raíz',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Mover',
      cancelButtonText: 'Cancelar',
    });

    if (targetFolder !== undefined) {
      try {
        await filesApi.moveFile(file.name, currentPath, targetFolder);
        onDelete(file.id);
        Swal.fire({
          title: '✅ Archivo movido',
          text: `"${file.name}" ha sido movido correctamente`,
          icon: 'success',
          timer: 2000,
        });
        onFileUpdated?.();
      } catch (error: any) {
        Swal.fire({
          title: 'Error',
          text: error.response?.data?.error || 'No se pudo mover el archivo',
          icon: 'error',
        });
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`p-3 rounded-lg border-2 transition-colors ${
        isCurrentFile
          ? 'border-blue-500 bg-blue-600 text-white'
          : 'border-gray-600 bg-gray-800 hover:border-blue-400 hover:bg-gray-700 text-gray-100'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex-1 cursor-pointer min-w-0"
          onClick={() => onPlay(file)}
        >
          {isRenaming ? (
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-2 py-1 border-2 border-blue-500 rounded text-gray-900 font-semibold focus:outline-none"
              autoFocus
            />
          ) : (
            <>
              <h4 className="font-semibold text-white truncate">{file.name}</h4>
              <p className="text-sm text-gray-300">
                {(file.size / 1024 / 1024).toFixed(2)} MB • {formatDate(file.uploadedAt)}
              </p>
            </>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {isRenaming ? (
            <>
              <button
                onClick={handleRename}
                className="px-2 py-1 bg-green-500 text-white hover:bg-green-600 rounded text-sm transition-colors"
              >
                ✓
              </button>
              <button
                onClick={() => setIsRenaming(false)}
                className="px-2 py-1 bg-gray-400 text-white hover:bg-gray-500 rounded text-sm transition-colors"
              >
                ✕
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsRenaming(true)}
                className="px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-sm transition-colors"
                title="Renombrar archivo"
              >
                ✏️
              </button>
              <button
                onClick={handleMoveFile}
                className="px-2 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded text-sm transition-colors"
                title="Mover archivo"
              >
                📂
              </button>
              <button
                onClick={handleDelete}
                className="px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-sm transition-colors"
                title="Eliminar archivo"
              >
                🗑️
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface FileListProps {
  files: FileInfo[];
  onPlay: (file: FileInfo) => void;
  onFileUpdated?: () => void;
}

export const FileList: React.FC<FileListProps> = ({ files, onPlay, onFileUpdated }) => {
  const { removeFile, updateFile } = useFilesStore();

  const handleRename = (fileId: string, newName: string) => {
    updateFile(fileId, { name: newName });
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-lg">📭 No hay archivos cargados</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <FileItem
          key={file.id}
          file={file}
          onPlay={onPlay}
          onDelete={(fileId) => removeFile(fileId)}
          onRename={handleRename}
          onFileUpdated={onFileUpdated}
        />
      ))}
    </div>
  );
};

import React, { useState } from 'react';
import { FileUpload } from '../FileUpload/FileUpload';
import { CreateFolder } from '../CreateFolder/CreateFolder';

interface ActionBarProps {
  onFolderCreated: () => void;
  onGoHome: () => void;
  onGoBack: () => void;
  currentPath: string;
  canGoBack?: boolean;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onFolderCreated,
  onGoHome,
  onGoBack,
  currentPath,
  canGoBack = false
}) => {
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);

  return (
    <div className="flex-shrink-0 bg-zinc-900 border-b border-zinc-800">
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        {/* Navigation buttons */}
        <div className="flex gap-2">
          <button
            onClick={onGoBack}
            disabled={!canGoBack}
            className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${canGoBack
                ? 'bg-zinc-700 text-white hover:bg-zinc-600'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
              }`}
            title="Volver a carpeta anterior"
          >
            ⬅ Atrás
          </button>

          <button
            onClick={onGoHome}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm transition-all duration-200 hover:bg-blue-700"
            title="Ir a inicio"
          >
            🏠 Inicio
          </button>
        </div>

        {/* Current Path */}
        <div className="flex-1 text-center">
          <p className="text-zinc-300 text-sm font-medium">
            {currentPath ? `📁 ${currentPath}` : '📚 Biblioteca'}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm transition-all duration-200 hover:bg-blue-700"
            title="Subir archivo"
          >
            📤 Subir
          </button>

          <button
            onClick={() => setShowCreateFolder(!showCreateFolder)}
            className="px-3 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-sm transition-all duration-200 hover:bg-emerald-700"
            title="Crear carpeta"
          >
            ➕ Carpeta
          </button>
        </div>
      </div>

      {/* Upload Panel */}
      {showUpload && (
        <div className="border-t border-zinc-800 bg-zinc-800/50 px-6 py-4 space-y-3 animate-slideUp">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-white">
              Subir archivo {currentPath && `en ${currentPath}`}
            </p>
            <button
              onClick={() => setShowUpload(false)}
              className="text-zinc-400 hover:text-white transition-colors"
              title="Cerrar"
            >
              ✕
            </button>
          </div>
          <FileUpload />
        </div>
      )}

      {/* Create Folder Panel */}
      {showCreateFolder && (
        <div className="border-t border-zinc-800 bg-zinc-800/50 px-6 py-4 space-y-3 animate-slideUp">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-white">Crear nueva carpeta</p>
            <button
              onClick={() => setShowCreateFolder(false)}
              className="text-zinc-400 hover:text-white transition-colors"
              title="Cerrar"
            >
              ✕
            </button>
          </div>
          <CreateFolder
            onFolderCreated={() => {
              onFolderCreated();
              setShowCreateFolder(false);
            }}
            currentPath={currentPath}
          />
        </div>
      )}
    </div>
  );
};

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
    <div style={{ 
      backgroundColor: '#111827',
      borderBottom: '1px solid #374151',
      flexShrink: 0
    }}>
      <div style={{ 
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '15px'
      }}>
        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Go Back Button */}
          <button
            onClick={onGoBack}
            disabled={!canGoBack}
            style={{
              backgroundColor: canGoBack ? '#6366f1' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              cursor: canGoBack ? 'pointer' : 'default',
              fontSize: '12px',
              fontWeight: '600',
              opacity: canGoBack ? 1 : 0.5
            }}
            title="Volver a carpeta anterior"
          >
            ⬅ Atrás
          </button>

          {/* Go Home Button */}
          <button
            onClick={onGoHome}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600'
            }}
            title="Ir a inicio"
          >
            🏠 Inicio
          </button>
        </div>

        {/* Title */}
        <div style={{
          flex: 1,
          color: 'white',
          fontSize: '14px',
          fontWeight: '600',
          textAlign: 'center'
        }}>
          🎵 Vitrox Song´s
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Upload Button */}
          <button
            onClick={() => setShowUpload(!showUpload)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
            title="Cargar archivo"
          >
            📤 Subir
          </button>

          {/* Create Folder Button */}
          <button
            onClick={() => setShowCreateFolder(!showCreateFolder)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
            title="Crear carpeta"
          >
            ➕ Carpeta
          </button>
        </div>
      </div>

      {/* Dropdown Upload */}
      {showUpload && (
        <div style={{ 
          borderTop: '1px solid #374151',
          padding: '12px 20px',
          backgroundColor: '#1f2937',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ 
              color: '#d1d5db',
              fontSize: '12px',
              fontWeight: '600',
              marginBottom: '8px'
            }}>
              Cargar archivo {currentPath && `en ${currentPath}`}
            </p>
            <FileUpload />
          </div>
          <button
            onClick={() => setShowUpload(false)}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '14px',
              flexShrink: 0,
              marginTop: '2px'
            }}
            title="Cerrar"
          >
            ✕
          </button>
        </div>
      )}

      {/* Dropdown Create Folder */}
      {showCreateFolder && (
        <div style={{ 
          borderTop: '1px solid #374151',
          padding: '12px 20px',
          backgroundColor: '#1f2937',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          <div style={{ flex: 1 }}>
            <CreateFolder 
              onFolderCreated={() => {
                onFolderCreated();
                setShowCreateFolder(false);
              }} 
              currentPath={currentPath} 
            />
          </div>
          <button
            onClick={() => setShowCreateFolder(false)}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '14px',
              flexShrink: 0,
              marginTop: '2px'
            }}
            title="Cerrar"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

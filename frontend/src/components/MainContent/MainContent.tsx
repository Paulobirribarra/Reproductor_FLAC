import React from 'react';
import type { FileInfo } from '../../types/index';

interface Folder {
  name: string;
  path: string;
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
  const totalItems = files.length + folders.length;

  return (
    <main style={{ backgroundColor: 'white', color: 'black', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>TOTAL: {totalItems} (Carpetas: {folders.length}, Archivos: {files.length})</h1>
      
      {error && <div style={{ color: 'red', marginBottom: '20px' }}>{error}</div>}
      
      {totalItems === 0 ? (
        <p>SIN ITEMS</p>
      ) : (
        <div>
          {/* Mostrar carpetas primero */}
          {folders.map((folder) => (
            <div 
              key={folder.path}
              style={{
                backgroundColor: '#fff3cd',
                padding: '10px',
                marginBottom: '10px',
                cursor: 'pointer',
                border: '2px solid #ffc107',
                borderRadius: '4px',
                fontWeight: 'bold'
              }}
              onClick={() => onFolderClick?.(folder.path)}
            >
              📁 {folder.name}
            </div>
          ))}

          {/* Mostrar archivos */}
          {files.map((file) => (
            <div 
              key={file.id}
              style={{
                backgroundColor: '#f0f0f0',
                padding: '10px',
                marginBottom: '10px',
                cursor: 'pointer',
                border: '1px solid black',
                borderRadius: '4px'
              }}
              onClick={() => onPlay(file)}
            >
              <strong>🎵 {file.name}</strong> - {(file.size / 1024 / 1024).toFixed(2)} MB
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

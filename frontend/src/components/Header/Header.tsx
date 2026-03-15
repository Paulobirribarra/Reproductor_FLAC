import React from 'react';
import { FolderBrowser } from '../FolderBrowser/FolderBrowser';

interface HeaderProps {
  onFolderNavigate: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onFolderNavigate }) => {
  return (
    <header className="fixed top-12 left-0 right-0 bg-gradient-to-b from-gray-900 to-gray-800 border-b border-gray-700 shadow-md z-40">
      <div className="max-w-full px-6 py-4 space-y-3">
        {/* Title and Description */}
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-white">🎵 Reproductor de Audio</h1>
          <p className="text-gray-400 text-xs">Sube y reproduce tus archivos FLAC y MP3 localmente</p>
        </div>

        {/* Folder Browser Navigation */}
        <div className="max-w-2xl mx-auto">
          <FolderBrowser onFolderNavigate={onFolderNavigate} />
        </div>
      </div>
    </header>
  );
};

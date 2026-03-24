import React from 'react';
import { FolderBrowser } from '../FolderBrowser/FolderBrowser';

interface HeaderProps {
  onFolderNavigate: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onFolderNavigate }) => {
  return (
    <header className="fixed top-0 left-0 right-0 bg-zinc-900 border-b border-zinc-800 shadow-lg z-50">
      <div className="max-w-full px-6 py-4 space-y-3">
        {/* Title and Description */}
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-white">🎵 Reproductor FLAC</h1>
          <p className="text-zinc-400 text-sm">Sube y reproduce tus archivos FLAC y MP3</p>
        </div>

        {/* Folder Browser Navigation */}
        <div className="max-w-2xl mx-auto">
          <FolderBrowser onFolderNavigate={onFolderNavigate} />
        </div>
      </div>
    </header>
  );
};

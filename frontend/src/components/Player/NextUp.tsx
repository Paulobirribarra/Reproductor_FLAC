import React from 'react';
import type { FileInfo } from '../../types/index';

interface NextUpProps {
  currentFile: FileInfo;
  files: FileInfo[];
}

export const NextUp: React.FC<NextUpProps> = ({ currentFile, files }) => {
  const currentIndex = files.findIndex((f) => f.name === currentFile.name && f.path === currentFile.path);
  const nextFile = currentIndex !== -1 && currentIndex < files.length - 1 
    ? files[currentIndex + 1] 
    : null;

  if (!nextFile) {
    return null;
  }

  return (
    <div className="mt-4 p-3 bg-gray-700 rounded-lg border-l-4 border-blue-500">
      <p className="text-xs text-gray-300 uppercase font-semibold mb-1">
        📋 Siguiente en cola
      </p>
      <p className="text-sm text-white font-semibold truncate">
        {nextFile.name}
      </p>
      <p className="text-xs text-gray-400">
        {(nextFile.size / 1024 / 1024).toFixed(2)} MB
      </p>
    </div>
  );
};

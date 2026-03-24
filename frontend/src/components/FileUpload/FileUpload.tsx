import React from 'react';
import { useDropzone } from 'react-dropzone';
import { filesApi } from '../../services/api';
import { useFilesStore } from '../../store/index';

export const FileUpload: React.FC = () => {
  const { addFile, setError, setLoading } = useFilesStore();
  const currentPath = useFilesStore((state) => state.currentPath);
  const [uploadProgress, setUploadProgress] = React.useState(0);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'audio/flac': ['.flac'],
      'audio/x-flac': ['.flac'],
      'audio/mpeg': ['.mp3'],
      'audio/mp3': ['.mp3'],
    },
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) {
        setError('Solo se permiten archivos FLAC y MP3');
        return;
      }

      setLoading(true);
      setError(null);

      for (const file of acceptedFiles) {
        try {
          const response = await filesApi.uploadFile(file, currentPath);
          if (response.data.success && response.data.data) {
            addFile(response.data.data);
          }
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Error al subir el archivo');
        }
      }

      setLoading(false);
      setUploadProgress(0);
    },
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${isDragActive
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-zinc-700 hover:border-blue-400 bg-zinc-800/30 hover:bg-zinc-800/50'
        }`}
    >
      <input {...getInputProps()} />
      <div className="text-zinc-300">
        <p className="text-lg font-semibold">
          {isDragActive ? '📁 Suelta aquí tus archivos FLAC o MP3' : '📁 Arrastra archivos FLAC o MP3 aquí'}
        </p>
        <p className="text-sm text-zinc-400 mt-2">o haz clic para seleccionar</p>
      </div>
    </div>
  );
};

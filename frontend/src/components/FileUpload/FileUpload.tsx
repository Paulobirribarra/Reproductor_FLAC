import React from 'react';
import { useDropzone } from 'react-dropzone';
import { filesApi } from '../../services/api';
import { useFilesStore } from '../../store/index';

interface FileUploadProps {
  onUploadComplete?: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
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
          // Obtener la ruta relativa si existe (proporcionada por react-dropzone al arrastrar carpetas)
          const relativePath = (file as any).path || '';
          let targetFolder = currentPath;

          // Si el archivo viene de una carpeta, ajustar la carpeta de destino
          if (relativePath && relativePath.includes('/')) {
            const fileDir = relativePath.substring(0, relativePath.lastIndexOf('/'));
            const cleanCurrentPath = currentPath === '/' ? '' : currentPath.replace(/\/+$/, '');
            const cleanFileDir = fileDir.replace(/^\/+/, '');
            targetFolder = cleanCurrentPath ? `${cleanCurrentPath}/${cleanFileDir}` : cleanFileDir;
          }

          const response = await filesApi.uploadFile(file, targetFolder);
          
          if (response.data.success && response.data.data) {
            const uploadedData = response.data.data;
            const filesToAdd = Array.isArray(uploadedData) ? uploadedData : [uploadedData];
            
            // Solo añadir al estado si el archivo pertenece a la carpeta que estamos viendo actualmente
            filesToAdd.forEach(f => {
              const fileFolderPath = f.path.includes('/') 
                ? f.path.substring(0, f.path.lastIndexOf('/'))
                : '';
              
              const normalizedCurrentPath = currentPath === '/' ? '' : currentPath.replace(/^\/|\/$/g, '');
              const normalizedFileFolder = fileFolderPath.replace(/^\/|\/$/g, '');

              if (normalizedCurrentPath === normalizedFileFolder) {
                addFile(f);
              }
            });
          }
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Error al subir el archivo');
        }
      }

      setLoading(false);
      setUploadProgress(0);
      
      // Notificar que la subida ha terminado para refrescar la lista de carpetas/archivos
      if (onUploadComplete) {
        onUploadComplete();
      }
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

import React from 'react';
import { useDropzone } from 'react-dropzone';
import { filesApi } from '../../services/api';
import { useFilesStore } from '../../store/index';

interface FileUploadProps {
  onUploadComplete?: () => void;
}

interface UploadStatus {
  total: number;
  current: number;
  currentFileName: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const { setError, setLoading } = useFilesStore();
  const currentPath = useFilesStore((state) => state.currentPath);
  const [uploadStatus, setUploadStatus] = React.useState<UploadStatus | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'audio/flac': ['.flac'],
      'audio/x-flac': ['.flac'],
      'audio/mpeg': ['.mp3'],
      'audio/mp3': ['.mp3'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) {
        setError('No se seleccionaron archivos compatibles (FLAC, MP3, JPG, PNG)');
        return;
      }

      setLoading(true);
      setError(null);
      setUploadStatus({
        total: acceptedFiles.length,
        current: 0,
        currentFileName: '',
      });

      let uploadedCount = 0;

      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        setUploadStatus({
          total: acceptedFiles.length,
          current: i + 1,
          currentFileName: file.name,
        });

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

          await filesApi.uploadFile(file, targetFolder);
          uploadedCount++;
        } catch (error) {
          console.error(`Error subiendo ${file.name}:`, error);
          setError(error instanceof Error ? error.message : `Error al subir ${file.name}`);
        }
      }

      setLoading(false);
      setUploadStatus(null);
      
      // Notificar que la subida ha terminado para refrescar la lista de carpetas/archivos
      if (onUploadComplete) {
        onUploadComplete();
      }
    },
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-zinc-700 hover:border-blue-400 bg-zinc-800/30 hover:bg-zinc-800/50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-zinc-300">
          <p className="text-lg font-semibold">
            {isDragActive ? '📁 Suelta aquí tus archivos' : '📁 Arrastra archivos aquí'}
          </p>
          <p className="text-sm text-zinc-400 mt-2">
            FLAC, MP3, carátulas (JPG, PNG) • o haz clic para seleccionar
          </p>
        </div>
      </div>

      {/* Indicador de progreso visible */}
      {uploadStatus && (
        <div className="p-3 bg-blue-950/40 border border-blue-800/50 rounded-lg flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-blue-300">
            <span className="animate-spin text-base">⏳</span>
            <span>
              Subiendo ({uploadStatus.current}/{uploadStatus.total}):{' '}
              <strong className="text-white font-medium">{uploadStatus.currentFileName}</strong>
            </span>
          </div>
          <span className="text-blue-400 text-xs font-mono font-semibold">
            {Math.round((uploadStatus.current / uploadStatus.total) * 100)}%
          </span>
        </div>
      )}
    </div>
  );
};

import React, { useCallback, useEffect } from 'react';
import { ActionBar } from './components/ActionBar/ActionBar';
import { MainContent } from './components/MainContent/MainContent';
import { PlayerFooter } from './components/PlayerFooter/PlayerFooter';
import { NowPlayingMetadata } from './components/NowPlayingMetadata';
import { AlbumPanel } from './components/AlbumPanel/AlbumPanel';
import { usePlayerStore, useFilesStore } from './store/index';
import { useFileLoader } from './hooks/useFileLoader';
import { useAudioWorker } from './hooks/useAudioWorker';
import { usePreloader } from './hooks/usePreloader';

function App() {
  const { files, currentPath, error, loadFiles } = useFileLoader();
  const folders = useFilesStore((state) => state.folders);
  const { sessionState, play, pause, seek, next, prev } = useAudioWorker(() => { });
  const { setCurrentFile } = usePlayerStore();
  const { preloadNextFile } = usePreloader();
  const currentFile = usePlayerStore((state) => state.currentFile);

  // Precargar siguiente archivo cuando cambia el actual
  useEffect(() => {
    if (currentFile && files.length > 0) {
      preloadNextFile(files, currentFile, currentPath);
    }
  }, [currentFile, files, currentPath, preloadNextFile]);

  const handlePlay = (file: any) => {
    // ✨ Si es un track chunked, expandir a lista automáticamente
    let playFile = file;
    let playPlaylist = files;

    if (file.isChunked && file.chunks && file.chunks.length > 0) {
      console.log(`[App] 🎵 Track chunked detectado: ${file.name}`);
      console.log(`[App] 📦 Expandiendo ${file.chunks.length} chunks`);
      console.log(`[App] 📋 Chunks recibidos:`, file.chunks); // Debug

      // Crear lista de reproducción de chunks ordenados
      const chunkedPlaylist = file.chunks
        .sort((a: any, b: any) => a.order - b.order)
        .map((chunk: any, index: number) => {
          const chunkObj = {
            id: `${file.id}_pt${chunk.order}`,
            name: chunk.name, // Debería ser _pt1.flac, _pt2.flac, etc.
            path: chunk.path,
            size: chunk.size,
            type: 'file',
            isChunk: true,
            chunkIndex: index,
            parentTrack: file.id,
            originalName: `${file.id}_pt${chunk.order}`,
            uploadedAt: file.uploadedAt,
          };
          console.log(`[App] 🎵 Chunk ${index}:`, chunkObj.name); // Debug
          return chunkObj;
        });

      // ⭐ IMPORTANTE: reproducir el PRIMER chunk (que existe físicamente)
      // Pero mostrar el track original en la UI
      playFile = {
        ...chunkedPlaylist[0], // Usar primer chunk para reproducción
        displayName: file.name, // Nombre visual del track completo
        parentTrackInfo: file, // Metadatos del track original
        isFirstChunk: true,
      };

      console.log(`[App] Reproduyendo chunk:`, playFile); // Debug
      playPlaylist = chunkedPlaylist;

      console.log(`[App] Iniciando reproducción de chunks...`);
    }

    setCurrentFile(playFile);
    play(playFile, playPlaylist);
  };

  const handleFolderClick = (folderPath: string) => {
    loadFiles(folderPath);
  };

  const handleGoHome = () => {
    loadFiles('');
  };

  const handleGoBack = () => {
    if (currentPath) {
      const parts = currentPath.split('/');
      const parentPath = parts.slice(0, -1).join('/');
      loadFiles(parentPath);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-zinc-950 text-zinc-100">
      {/* ActionBar */}
      <ActionBar
        onFolderCreated={() => loadFiles(currentPath)}
        onGoHome={handleGoHome}
        onGoBack={handleGoBack}
        currentPath={currentPath}
        canGoBack={!!currentPath}
      />

      {/* Breadcrumb simple */}
      <div className="bg-zinc-800 text-zinc-300 px-6 py-2 text-sm flex-shrink-0 border-b border-zinc-700">
        {currentPath ? <span> {currentPath}</span> : <span className="text-zinc-500">Raíz</span>}
      </div>

      {/* Main Content - Lista de archivos y carpetas */}
      <MainContent
        files={files}
        folders={folders}
        onPlay={handlePlay}
        onFolderClick={handleFolderClick}
        onFileUpdated={() => loadFiles(currentPath)}
        error={error}
      />

      {/* Footer - Reproductor */}
      <PlayerFooter
        sessionState={sessionState}
        files={files}
        onPlayPause={() => {
          if (sessionState.isPlaying) pause();
          else if (sessionState.currentFile) play(sessionState.currentFile, files);
        }}
        onSeek={seek}
        onNext={next}
        onPrev={prev}
      />

      {/* Now Playing Metadata Info */}
      <NowPlayingMetadata />

      {/* Album Details Panel */}
      <AlbumPanel />
    </div>
  );
}

export default App;

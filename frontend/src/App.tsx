import React, { useCallback, useEffect, useState } from 'react';
import { TopBar } from './components/Navigation/TopBar';

import { FileUpload } from './components/FileUpload/FileUpload';
import { CreateFolder } from './components/CreateFolder/CreateFolder';
import { MainContent } from './components/MainContent/MainContent';
import { PlayerDock } from './components/Player/PlayerDock';
import { AlbumPanel } from './components/AlbumPanel/AlbumPanel';
import { PlaylistModal } from './components/Playlist/PlaylistModal';
import { AddToPlaylistModal } from './components/Playlist/AddToPlaylistModal';
import { usePlayerStore, useFilesStore } from './store/index';
import { useFileLoader } from './hooks/useFileLoader';
import { useAudioWorker } from './hooks/useAudioWorker';
import { usePreloader } from './hooks/usePreloader';
import { useLastFmScrobbler } from './hooks/useLastFmScrobbler';
import { useMediaSession } from './hooks/useMediaSession';

function App() {
  const [isPlayerCollapsed, setIsPlayerCollapsed] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [fileToAddToPlaylist, setFileToAddToPlaylist] = useState<any>(null);
  const { files, currentPath, error, loadFiles } = useFileLoader();
  const folders = useFilesStore((state) => state.folders);
  const { sessionState, play, pause, resume, stop, seek, next, prev } = useAudioWorker(() => { });
  const { setCurrentFile } = usePlayerStore();
  const { preloadNextFile } = usePreloader();
  const currentFile = usePlayerStore((state) => state.currentFile);

  // Mantener sincronizado currentFile de usePlayerStore con sessionState del audioWorker
  useEffect(() => {
    if (sessionState.currentFile) {
      const workerFile = sessionState.currentFile;
      // Solo actualizar si es diferente al que tiene usePlayerStore
      if (!currentFile || (currentFile.path !== workerFile.path && currentFile.name !== workerFile.name)) {
        setCurrentFile(workerFile);
      }
    }
  }, [sessionState.currentFile, currentFile, setCurrentFile]);

  // Sincronización automática de Now Playing y Scrobbles con Last.fm
  useLastFmScrobbler(sessionState);

  // Sincronización con la MediaSession API (controles nativos en pantalla de bloqueo y background)
  useMediaSession(sessionState, {
    play: () => resume(),
    pause: () => pause(),
    resume: () => resume(),
    stop: () => stop(),
    seek: (time) => seek(time),
    next: () => next(),
    prev: () => prev(),
  });

  // Precargar siguiente archivo desactivado para evitar saturación de red innecesaria
  // useEffect(() => {
  //   if (currentFile && files.length > 0) {
  //     preloadNextFile(files, currentFile, currentPath);
  //   }
  // }, [currentFile, files, currentPath, preloadNextFile]);

  const handlePlay = (file: any) => {
    // Filtrar la playlist para que contenga ÚNICAMENTE archivos de audio (evitar .jpg, .cue, etc.)
    const isAudio = (name: string) => /\.(flac|mp3|wav|ogg|m4a|ape|wv|wma)$/i.test(name);
    const audioPlaylist = files.filter(f => isAudio(f.name));

    // ✨ Si es un track chunked, expandir a lista automáticamente
    let playFile = file;
    let playPlaylist = audioPlaylist;

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
    <div className="w-full h-screen flex flex-col bg-zinc-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(39,39,42,0.6),rgba(9,9,11,1))] text-zinc-100 overflow-hidden relative">
      {/* TopBar unificada (Navegación + Breadcrumb interactivo + Acciones) */}
      <TopBar
        currentPath={currentPath}
        canGoBack={!!currentPath}
        onGoBack={handleGoBack}
        onGoHome={handleGoHome}
        onNavigateToPath={(path) => loadFiles(path)}
        onOpenUpload={() => setShowUpload((prev) => !prev)}
        onOpenCreateFolder={() => setShowCreateFolder((prev) => !prev)}
        onOpenPlaylists={() => setIsPlaylistModalOpen(true)}
      />

      {/* Paneles desplegables de subida y crear carpeta */}
      {showUpload && (
        <div className="border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md px-6 py-4 animate-slideDown">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-semibold text-white">Subir archivos FLAC</p>
            <button
              onClick={() => setShowUpload(false)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              ✕
            </button>
            {/* Toast container */}
        <Toaster
          position="bottom-right"
          reverseOrder={false}
          toastOptions={{
            style: {
              background: '#1e1e1e',
              color: '#fff',
            },
          }}
        />
      </div>
          <FileUpload onUploadComplete={() => {
            loadFiles(currentPath);
            setShowUpload(false);
          }} />
          {/* Toast container */}
        <Toaster
          position="bottom-right"
          reverseOrder={false}
          toastOptions={{
            style: {
              background: '#1e1e1e',
              color: '#fff',
            },
          }}
        />
      </div>
      )}

      {showCreateFolder && (
        <div className="border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md px-6 py-4 animate-slideDown">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-semibold text-white">Crear nueva carpeta</p>
            <button
              onClick={() => setShowCreateFolder(false)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              ✕
            </button>
            {/* Toast container */}
        <Toaster
          position="bottom-right"
          reverseOrder={false}
          toastOptions={{
            style: {
              background: '#1e1e1e',
              color: '#fff',
            },
          }}
        />
      </div>
          <CreateFolder
            onFolderCreated={() => {
              loadFiles(currentPath);
              setShowCreateFolder(false);
            }}
            currentPath={currentPath}
          />
          {/* Toast container */}
        <Toaster
          position="bottom-right"
          reverseOrder={false}
          toastOptions={{
            style: {
              background: '#1e1e1e',
              color: '#fff',
            },
          }}
        />
      </div>
      )}

      {/* Main Content - Lista de archivos y carpetas */}
      <MainContent
        files={files}
        folders={folders}
        onPlay={handlePlay}
        onFolderClick={handleFolderClick}
        onFileUpdated={() => loadFiles(currentPath)}
        onAddToPlaylist={(file) => setFileToAddToPlaylist(file)}
        error={error}
      />

      {/* Reproductor Flotante Moderno estilo Dock */}
      <PlayerDock
        sessionState={sessionState}
        onPlayPause={() => {
          if (sessionState.isPlaying) {
            pause();
          } else if (sessionState.currentFile) {
            resume();
          }
        }}
        onStop={stop}
        onSeek={seek}
        onNext={next}
        onPrev={prev}
        onNavigateFolder={handleFolderClick}
      />

      {/* Album Details Panel */}
      <AlbumPanel />

      {/* Playlists Management Modal */}
      <PlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        onPlayTrack={(track, playlistTracks) => {
          setCurrentFile(track);
          play(track, playlistTracks);
        }}
      />

      {/* Add Track to Playlist Modal */}
      <AddToPlaylistModal
        isOpen={!!fileToAddToPlaylist}
        onClose={() => setFileToAddToPlaylist(null)}
        file={fileToAddToPlaylist}
        currentFolder={currentPath}
      />
    </div>
  );
}

export default App;

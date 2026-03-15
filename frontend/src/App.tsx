import React, { useCallback, useEffect } from 'react';
import { ActionBar } from './components/ActionBar/ActionBar';
import { MainContent } from './components/MainContent/MainContent';
import { PlayerFooter } from './components/PlayerFooter/PlayerFooter';
import { usePlayerStore, useFilesStore } from './store/index';
import { useFileLoader } from './hooks/useFileLoader';
import { useAudioWorker } from './hooks/useAudioWorker';
import { usePreloader } from './hooks/usePreloader';

function App() {
  const { files, currentPath, error, loadFiles } = useFileLoader();
  const folders = useFilesStore((state) => state.folders);
  const { sessionState, play, pause, seek, next, prev } = useAudioWorker(() => {});
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
    setCurrentFile(file);
    play(file, files);
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
    <div style={{ 
      width: '100%', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: 'white'
    }}>
      {/* ActionBar - controles */}
      <ActionBar 
        onFolderCreated={() => loadFiles(currentPath)}
        onGoHome={handleGoHome}
        onGoBack={handleGoBack}
        currentPath={currentPath}
        canGoBack={!!currentPath}
      />
      
      {/* Breadcrumb simple */}
      <div style={{ 
        backgroundColor: '#1e3a8a', 
        color: 'white', 
        padding: '8px 20px',
        flexShrink: 0,
        fontSize: '12px'
      }}>
        {currentPath && <span>📍 {currentPath}</span>}
      </div>
      
      {/* Main Content - Lista de archivos y carpetas */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto',
        backgroundColor: '#f3f4f6',
        padding: '10px'
      }}>
        <MainContent 
          files={files}
          folders={folders}
          onPlay={handlePlay}
          onFolderClick={handleFolderClick}
          onFileUpdated={() => loadFiles(currentPath)}
          error={error}
        />
      </div>
      
      {/* Footer - Reproductor */}
      <div style={{ 
        backgroundColor: '#1e40af', 
        color: 'white', 
        flexShrink: 0,
        borderTop: '1px solid #1e3a8a',
        minHeight: '80px'
      }}>
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
      </div>
    </div>
  );
}

export default App;

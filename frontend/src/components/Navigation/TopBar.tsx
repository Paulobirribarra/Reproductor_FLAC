import React from 'react';
import { LastFmWidget } from '../LastFm/LastFmWidget';

interface TopBarProps {
  currentPath: string;
  canGoBack: boolean;
  onGoBack: () => void;
  onGoHome: () => void;
  onNavigateToPath: (path: string) => void;
  onOpenUpload: () => void;
  onOpenCreateFolder: () => void;
  onOpenPlaylists?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentPath,
  canGoBack,
  onGoBack,
  onGoHome,
  onNavigateToPath,
  onOpenUpload,
  onOpenCreateFolder,
  onOpenPlaylists,
}) => {
  // Construir segmentos del breadcrumb interactivos
  const pathSegments = currentPath ? currentPath.split('/').filter(Boolean) : [];

  return (
    <header className="sticky top-0 z-30 flex-shrink-0 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80 px-6 py-3 transition-colors">
      <div className="flex items-center justify-between gap-4">
        {/* Lado izquierdo: Navegación y Breadcrumbs interactivos */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onGoBack}
              disabled={!canGoBack}
              className={`w-8 h-8 flex items-center justify-center rounded-xl font-bold text-xs transition-all ${
                canGoBack
                  ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800'
                  : 'bg-zinc-900/40 text-zinc-600 border border-zinc-900 cursor-not-allowed opacity-40'
              }`}
              title="Volver atrás"
            >
              ←
            </button>
            <button
              onClick={onGoHome}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-all text-xs"
              title="Ir a inicio (raíz)"
            >
              🏠
            </button>
          </div>

          {/* Breadcrumb estilo Chips interactivos */}
          <nav aria-label="Ruta de carpetas" className="flex items-center gap-1.5 overflow-x-auto text-xs min-w-0 py-0.5 no-scrollbar">
            <button
              onClick={onGoHome}
              className={`px-2.5 py-1 rounded-lg transition-colors font-medium flex-shrink-0 ${
                pathSegments.length === 0
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              Biblioteca
            </button>

            {pathSegments.map((segment, index) => {
              const fullSubPath = pathSegments.slice(0, index + 1).join('/');
              const isLast = index === pathSegments.length - 1;

              return (
                <React.Fragment key={fullSubPath}>
                  <span className="text-zinc-600 text-[10px] select-none">/</span>
                  <button
                    onClick={() => !isLast && onNavigateToPath(fullSubPath)}
                    disabled={isLast}
                    className={`px-2 py-1 rounded-lg truncate max-w-[160px] transition-colors font-medium flex-shrink-0 ${
                      isLast
                        ? 'bg-zinc-800 text-white border border-zinc-700/60 font-semibold cursor-default'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                    title={segment}
                  >
                    {segment}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Lado derecho: Acciones rápidas y widget Last.fm */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <LastFmWidget />

          {onOpenPlaylists && (
            <button
              onClick={onOpenPlaylists}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 rounded-xl font-medium text-xs transition-all flex items-center gap-1.5"
              title="Ver Playlists"
            >
              <span>📋</span>
              <span className="hidden sm:inline">Playlists</span>
            </button>
          )}

          <button
            onClick={onOpenCreateFolder}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 rounded-xl font-medium text-xs transition-all flex items-center gap-1.5"
            title="Crear nueva carpeta"
          >
            <span>📁+</span>
            <span className="hidden md:inline">Carpeta</span>
          </button>

          <button
            onClick={onOpenUpload}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-xs transition-all shadow-md shadow-blue-900/30 flex items-center gap-1.5"
            title="Subir archivos FLAC"
          >
            <span>⬆️</span>
            <span className="hidden sm:inline">Subir</span>
          </button>
        </div>
      </div>
    </header>
  );
};

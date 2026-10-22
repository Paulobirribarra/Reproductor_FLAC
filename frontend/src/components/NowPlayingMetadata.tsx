import React from 'react';
import { useNowPlayingMetadata } from '../hooks/useNowPlayingMetadata';
import { usePlayerStore } from '../store/index';

interface NowPlayingMetadataProps {
    onNavigateFolder?: (folderPath: string) => void;
    fallbackDuration?: number;
}

const formatDuration = (seconds?: number): string => {
    if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const NowPlayingMetadata: React.FC<NowPlayingMetadataProps> = ({
    onNavigateFolder,
    fallbackDuration,
}) => {
    const metadata = useNowPlayingMetadata();
    const { currentFile, setAlbumPanelOpen } = usePlayerStore();

    if (!metadata.title && !metadata.artist && !metadata.album) {
        return null;
    }

    const handleCoverClick = () => {
        setAlbumPanelOpen(true);
    };

    // Calcular ruta de la carpeta del álbum y del artista a partir del archivo actual
    const getFolderPaths = () => {
        const fullPath = currentFile?.path || (currentFile?.folder ? `${currentFile.folder}/${currentFile.name}` : '');
        if (!fullPath) return { albumFolder: '', artistFolder: '' };

        const parts = fullPath.split('/').filter(Boolean);
        if (parts.length <= 1) {
            // El archivo está en la raíz
            return { albumFolder: '', artistFolder: '' };
        }

        // parts = ['Elend', '2007 - A World In Their Screams', '1. Ophis Puthon.flac']
        // albumFolder = 'Elend/2007 - A World In Their Screams'
        const albumParts = parts.slice(0, -1);
        const albumFolder = albumParts.join('/');

        // artistFolder: si tiene 2 o más niveles de carpetas, el primer nivel es el artista
        const artistFolder = albumParts.length > 1 ? albumParts.slice(0, -1).join('/') : albumFolder;

        return { albumFolder, artistFolder };
    };

    const handleArtistClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const { artistFolder, albumFolder } = getFolderPaths();
        const target = artistFolder || albumFolder;
        if (onNavigateFolder) {
            onNavigateFolder(target);
        }
    };

    const handleAlbumClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const { albumFolder } = getFolderPaths();
        if (onNavigateFolder) {
            onNavigateFolder(albumFolder);
        }
    };

    // Priorizar duración: si metadata tiene duración válida (FLAC header), usarla. Si no, usar la duración real del reproductor
    const displayDuration = (metadata.duration && metadata.duration > 1)
        ? metadata.duration
        : (fallbackDuration && fallbackDuration > 1 ? fallbackDuration : undefined);

    const formattedDuration = formatDuration(displayDuration);

    const { albumFolder, artistFolder } = getFolderPaths();
    const canNavigate = Boolean(albumFolder || artistFolder);

    return (
        <div className="flex gap-4 items-center px-6 py-3 bg-zinc-800 border-t border-zinc-700 text-zinc-100">
            {/* Cover - Clickeable con fallback si no hay carátula */}
            <button
                onClick={handleCoverClick}
                className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 group transition-all duration-200 hover:shadow-lg hover:scale-105 active:scale-95 bg-zinc-700 flex items-center justify-center border border-zinc-600"
                title="Haz clic para ver letras e información"
            >
                {metadata.cover?.url ? (
                    <img
                        src={metadata.cover.url}
                        alt="Album cover"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <span className="text-3xl opacity-70">🎵</span>
                )}
                {/* Overlay hover */}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-all duration-200 flex items-center justify-center">
                    <span className="text-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        📜
                    </span>
                </div>
            </button>

            {/* Metadata Text */}
            <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-white truncate">
                    {metadata.title || currentFile?.name || '(sin título)'}
                </div>

                {metadata.artist && (
                    <div className="text-xs text-zinc-400 truncate mt-0.5">
                        <button
                            onClick={handleArtistClick}
                            className={`inline-flex items-center gap-1 text-left transition-colors ${
                                canNavigate
                                    ? 'hover:text-blue-400 hover:underline cursor-pointer group'
                                    : 'cursor-default'
                            }`}
                            title={canNavigate ? 'Clic para ir a la carpeta del artista' : undefined}
                        >
                            <span>🎤 {metadata.artist}</span>
                            {canNavigate && (
                                <span className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-400">
                                    ↗
                                </span>
                            )}
                        </button>
                    </div>
                )}

                {metadata.album && (
                    <div className="text-xs text-zinc-400 truncate mt-0.5">
                        <button
                            onClick={handleAlbumClick}
                            className={`inline-flex items-center gap-1 text-left transition-colors ${
                                canNavigate
                                    ? 'hover:text-blue-400 hover:underline cursor-pointer group'
                                    : 'cursor-default'
                            }`}
                            title={canNavigate ? 'Clic para ir a la carpeta del álbum' : undefined}
                        >
                            <span>💿 {metadata.album}</span>
                            {canNavigate && (
                                <span className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-400">
                                    ↗
                                </span>
                            )}
                        </button>
                    </div>
                )}

                {/* Info Row */}
                <div className="text-xs text-zinc-500 mt-1 flex flex-wrap items-center gap-3">
                    {metadata.year && <span>📅 {metadata.year}</span>}
                    {metadata.genre && <span>🎵 {metadata.genre}</span>}
                    {formattedDuration && <span>⏱️ {formattedDuration}</span>}
                    {metadata.sampleRate && <span>🔊 {(metadata.sampleRate / 1000).toFixed(0)}kHz</span>}
                </div>
            </div>

            {/* Botón de acceso directo a Letras / Info */}
            <button
                onClick={() => setAlbumPanelOpen(true)}
                className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 border ${
                    metadata.lyrics
                        ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-500/40'
                        : 'bg-zinc-700/50 hover:bg-zinc-700 text-zinc-400 border-zinc-600'
                }`}
                title={metadata.lyrics ? 'Ver letra' : 'Ver información del tema'}
            >
                <span>📜</span>
                <span className="hidden sm:inline">{metadata.lyrics ? 'Ver Letra' : 'Info'}</span>
            </button>

            {/* Loading */}
            {metadata.loading && (
                <div className="text-xs text-amber-400 flex-shrink-0 animate-spin">
                    ⟳ Extrayendo...
                </div>
            )}

            {/* Error */}
            {metadata.error && (
                <div className="text-xs text-red-400 flex-shrink-0 cursor-help" title={metadata.error}>
                    ⚠️
                </div>
            )}
        </div>
    );
};

export default NowPlayingMetadata;

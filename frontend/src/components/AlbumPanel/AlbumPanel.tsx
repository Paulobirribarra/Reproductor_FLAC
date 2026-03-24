import React from 'react';
import { useNowPlayingMetadata } from '../../hooks/useNowPlayingMetadata';
import { usePlayerStore } from '../../store/index';

export const AlbumPanel: React.FC = () => {
    const metadata = useNowPlayingMetadata();
    const { albumPanelOpen, setAlbumPanelOpen } = usePlayerStore();

    if (!albumPanelOpen) return null;

    // Si no hay metadatos, no mostrar el panel
    if (!metadata.title && !metadata.artist && !metadata.album && !metadata.cover?.url) {
        return null;
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm transition-opacity duration-200"
                onClick={() => setAlbumPanelOpen(false)}
            />

            {/* Panel deslizable */}
            <div className="fixed right-0 top-0 bottom-0 w-96 bg-zinc-900 border-l border-zinc-700 shadow-2xl z-50 flex flex-col overflow-hidden animate-slideUp">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700 flex-shrink-0">
                    <h2 className="text-lg font-bold text-white">🎵 Ahora reproduciendo</h2>
                    <button
                        onClick={() => setAlbumPanelOpen(false)}
                        className="text-zinc-400 hover:text-white text-2xl transition-colors duration-200"
                        title="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {/* Cover Art */}
                    {metadata.cover?.url ? (
                        <div className="flex justify-center">
                            <img
                                src={metadata.cover.url}
                                alt="Album cover"
                                className="w-64 h-64 rounded-lg shadow-2xl object-cover border border-zinc-700"
                            />
                        </div>
                    ) : (
                        <div className="flex justify-center">
                            <div className="w-64 h-64 bg-zinc-800 rounded-lg border border-zinc-700 flex items-center justify-center text-6xl opacity-30">
                                🎵
                            </div>
                        </div>
                    )}

                    {/* Music Info */}
                    <div className="space-y-4">
                        {/* Title */}
                        {metadata.title && (
                            <div>
                                <h3 className="text-2xl font-bold text-white break-words">
                                    {metadata.title}
                                </h3>
                            </div>
                        )}

                        {/* Artist */}
                        {metadata.artist && (
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                                    Artista
                                </p>
                                <p className="text-lg text-blue-400 break-words">
                                    {metadata.artist}
                                </p>
                            </div>
                        )}

                        {/* Album */}
                        {metadata.album && (
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                                    Álbum
                                </p>
                                <p className="text-base text-zinc-200 break-words">
                                    {metadata.album}
                                </p>
                            </div>
                        )}

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-700">
                            {metadata.year && (
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-zinc-400 uppercase">Año</p>
                                    <p className="text-sm text-zinc-200">{metadata.year}</p>
                                </div>
                            )}

                            {metadata.genre && (
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-zinc-400 uppercase">Género</p>
                                    <p className="text-sm text-zinc-200">{metadata.genre}</p>
                                </div>
                            )}

                            {metadata.duration && (
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-zinc-400 uppercase">Duración</p>
                                    <p className="text-sm text-zinc-200">
                                        {Math.floor(metadata.duration / 60)}:{String(Math.floor(metadata.duration % 60)).padStart(2, '0')}
                                    </p>
                                </div>
                            )}

                            {metadata.sampleRate && (
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-zinc-400 uppercase">Bitrate</p>
                                    <p className="text-sm text-zinc-200">
                                        {(metadata.sampleRate / 1000).toFixed(0)}kHz
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Loading State */}
                    {metadata.loading && (
                        <div className="flex items-center justify-center py-8 text-amber-400 animate-spin">
                            ⟳ Extrayendo metadatos...
                        </div>
                    )}

                    {/* Error State */}
                    {metadata.error && (
                        <div className="p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-100 text-sm">
                            ⚠️ {metadata.error}
                        </div>
                    )}
                </div>

                {/* Footer Hint */}
                <div className="px-6 py-4 bg-zinc-800/50 border-t border-zinc-700 text-center text-xs text-zinc-500 flex-shrink-0">
                    Haz clic en la carátula para cerrar
                </div>
            </div>
        </>
    );
};

export default AlbumPanel;

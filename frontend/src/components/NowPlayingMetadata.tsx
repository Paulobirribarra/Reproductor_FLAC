import React from 'react';
import { useNowPlayingMetadata } from '../hooks/useNowPlayingMetadata';
import { usePlayerStore } from '../store/index';

export const NowPlayingMetadata: React.FC = () => {
    const metadata = useNowPlayingMetadata();
    const { setAlbumPanelOpen } = usePlayerStore();

    if (!metadata.title && !metadata.artist && !metadata.album) {
        return null;
    }

    const handleCoverClick = () => {
        if (metadata.cover?.url) {
            setAlbumPanelOpen(true);
        }
    };

    return (
        <div className="flex gap-4 items-start px-6 py-3 bg-zinc-800 border-t border-zinc-700 text-zinc-100">
            {/* Cover - Clickeable */}
            {metadata.cover?.url && (
                <button
                    onClick={handleCoverClick}
                    className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 group transition-all duration-200 hover:shadow-lg hover:scale-105 active:scale-95"
                    title="Haz clic para ver más detalles"
                >
                    <img
                        src={metadata.cover.url}
                        alt="Album cover"
                        className="w-full h-full object-cover"
                    />
                    {/* Overlay hover */}
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center">
                        <span className="text-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            👁️
                        </span>
                    </div>
                </button>
            )}

            {/* Metadata Text */}
            <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-white truncate">
                    {metadata.title || '(sin título)'}
                </div>

                {metadata.artist && (
                    <div className="text-xs text-zinc-400 truncate">
                        🎤 {metadata.artist}
                    </div>
                )}

                {metadata.album && (
                    <div className="text-xs text-zinc-400 truncate">
                        💿 {metadata.album}
                    </div>
                )}

                {/* Info Row */}
                <div className="text-xs text-zinc-500 mt-1 flex flex-wrap gap-3">
                    {metadata.year && <span>📅 {metadata.year}</span>}
                    {metadata.genre && <span>🎵 {metadata.genre}</span>}
                    {metadata.duration && <span>⏱️ {(metadata.duration / 60).toFixed(2)}m</span>}
                    {metadata.sampleRate && <span>🔊 {(metadata.sampleRate / 1000).toFixed(0)}kHz</span>}
                </div>
            </div>

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

import React, { useState } from 'react';
import { extractAudioMetadata, printMetadata } from '../services/metadataExtractor';

interface AudioMetadata {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    genre?: string;
    duration?: number;
    cover?: {
        url?: string;
        type?: string;
    };
}

export const MetadataDebugger: React.FC = () => {
    const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);

        try {
            const extracted = await extractAudioMetadata(file);
            setMetadata(extracted);
            printMetadata(extracted, file.name);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            setError(message);
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleURLInput = async () => {
        const url = prompt('Ingresa la URL del archivo de audio:');
        if (!url) return;

        setLoading(true);
        setError(null);

        try {
            const extracted = await extractAudioMetadata(url);
            setMetadata(extracted);
            printMetadata(extracted, url);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            setError(message);
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-0 right-0 w-96 h-96 bg-black/90 border-l-2 border-t-2 border-green-500 overflow-auto z-50 font-mono text-xs text-green-400 p-4">
            {/* Header */}
            <div className="mb-4 border-b border-green-500 pb-2">
                <h3 className="text-green-300 font-bold text-sm uppercase">🔍 Metadata Debugger</h3>
            </div>

            {/* Controls */}
            <div className="mb-4 space-y-2">
                <label className="block">
                    <span className="text-yellow-400">📁 Seleccionar archivo:</span>
                    <input
                        type="file"
                        accept="audio/*"
                        onChange={handleFileInput}
                        className="block w-full mt-1 text-xs bg-gray-800 text-white p-1 cursor-pointer"
                        disabled={loading}
                    />
                </label>
                <button
                    onClick={handleURLInput}
                    disabled={loading}
                    className="w-full bg-green-700 hover:bg-green-600 disabled:bg-gray-600 text-white px-2 py-1 text-xs uppercase"
                >
                    {loading ? '⏳ Procesando...' : '🌐 Cargar desde URL'}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-4 p-2 bg-red-900/50 border border-red-500 text-red-400 text-xs">
                    <strong>❌ Error:</strong> {error}
                </div>
            )}

            {/* Results */}
            {metadata && (
                <div className="space-y-2 text-green-400">
                    <div>
                        <span className="text-cyan-400">╔═══════════════════════</span>
                    </div>

                    <div className="space-y-1">
                        <div>
                            <span className="text-blue-400">TITLE:</span> {metadata.title || '[N/A]'}
                        </div>
                        <div>
                            <span className="text-blue-400">ARTIST:</span> {metadata.artist || '[N/A]'}
                        </div>
                        <div>
                            <span className="text-blue-400">ALBUM:</span> {metadata.album || '[N/A]'}
                        </div>
                        <div>
                            <span className="text-blue-400">GENRE:</span> {metadata.genre || '[N/A]'}
                        </div>
                        <div>
                            <span className="text-blue-400">YEAR:</span> {metadata.year || '[N/A]'}
                        </div>
                        {metadata.duration && (
                            <div>
                                <span className="text-blue-400">DURATION:</span> {(metadata.duration / 60).toFixed(2)}m
                            </div>
                        )}
                        {metadata.cover && (
                            <div>
                                <span className="text-blue-400">COVER:</span> {metadata.cover.type || 'unknown'}
                            </div>
                        )}
                    </div>

                    <div>
                        <span className="text-cyan-400">╚═══════════════════════</span>
                    </div>

                    {/* Cover Preview */}
                    {metadata.cover?.url && (
                        <div className="mt-4">
                            <div className="text-yellow-400 text-xs mb-1">🖼️ COVER PREVIEW:</div>
                            <img
                                src={metadata.cover.url}
                                alt="Album cover"
                                className="w-24 h-24 object-cover border border-green-500"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Empty state */}
            {!metadata && !error && !loading && (
                <div className="text-gray-500 text-xs">
                    👉 Carga un archivo de audio para ver los metadatos...
                </div>
            )}
        </div>
    );
};

export default MetadataDebugger;

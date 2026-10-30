import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../store/index';
import { extractAudioMetadata } from '../services/metadataExtractor';

interface NowPlayingMetadata {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    genre?: string;
    duration?: number;
    sampleRate?: number;
    lyrics?: string;
    cover?: {
        url?: string;
        type?: string;
    };
    loading?: boolean;
    error?: string | null;
}

export function useNowPlayingMetadata(): NowPlayingMetadata {
    const currentFile = usePlayerStore((state) => state.currentFile);
    const [metadata, setMetadata] = useState<NowPlayingMetadata>({
        loading: false,
        error: null,
    });
    const lastCoverUrlRef = useRef<string | null>(null);

    useEffect(() => {
        if (!currentFile) {
            setMetadata({ loading: false, error: null });
            return;
        }

        const fetchMetadata = async () => {
            setMetadata({ loading: true, error: null });
            //console.log(`[useNowPlayingMetadata] Cargando: ${currentFile.name}`);

            try {
                // Si tiene path, usarlo; si no, construir desde folder + name
                let relativePath: string;
                if (currentFile.path) {
                    relativePath = currentFile.path;
                } else if (currentFile.folder && currentFile.name) {
                    relativePath = `${currentFile.folder}/${currentFile.name}`;
                } else {
                    throw new Error(`No hay path disponible para ${currentFile.name}`);
                }

                // Codificar cada segmento de la ruta individualmente para preservar los '/'
                const encodedPath = relativePath
                    .split('/')
                    .map((segment) => encodeURIComponent(segment))
                    .join('/');

                // Usar ruta relativa /uploads para pasar por el proxy de Vite (evita Mixed Content y CORS en HTTPS)
                const fileUrl = `/uploads/${encodedPath}`;

                //console.log(`[useNowPlayingMetadata] URL: ${fileUrl}`);

                const extracted = await extractAudioMetadata(fileUrl);

                setMetadata({
                    ...extracted,
                    loading: false,
                    error: null,
                });

                // Cleanup: guardar referencia al nuevo cover URL
                if (lastCoverUrlRef.current && lastCoverUrlRef.current !== extracted.cover?.url) {
                    URL.revokeObjectURL(lastCoverUrlRef.current);
                }
                lastCoverUrlRef.current = extracted.cover?.url || null;

                //console.log(`[useNowPlayingMetadata] ✓ ${extracted.title || currentFile.name}`);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
                setMetadata({
                    loading: false,
                    error: errorMsg,
                });
                //console.error('[useNowPlayingMetadata] Error:', errorMsg);
            }
        };

        fetchMetadata();
    }, [currentFile?.id, currentFile?.path, currentFile?.name]);

    // Cleanup en unmount
    useEffect(() => {
        return () => {
            if (lastCoverUrlRef.current) {
                URL.revokeObjectURL(lastCoverUrlRef.current);
                //console.log('[useNowPlayingMetadata] Blob URL cleaned up');
            }
        };
    }, []);

    return metadata;
}

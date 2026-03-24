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
            console.log(`[useNowPlayingMetadata] Cargando: ${currentFile.name}`);

            try {
                // Obtener URL del backend (puerto 3000)
                const backendUrl = `http://${window.location.hostname}:3000`;

                // Construir URL desde el objeto currentFile
                // currentFile tiene: { id, name, path, folder, ... }
                let fileUrl: string;

                // Si tiene path, usarlo; si no, construir desde folder + name
                if (currentFile.path) {
                    fileUrl = `${backendUrl}/uploads/${currentFile.path}`;
                } else if (currentFile.folder && currentFile.name) {
                    fileUrl = `${backendUrl}/uploads/${currentFile.folder}/${currentFile.name}`;
                } else {
                    throw new Error(`No hay path disponible para ${currentFile.name}`);
                }

                console.log(`[useNowPlayingMetadata] URL: ${fileUrl}`);

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

                console.log(`[useNowPlayingMetadata] ✓ ${extracted.title || currentFile.name}`);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
                setMetadata({
                    loading: false,
                    error: errorMsg,
                });
                console.error('[useNowPlayingMetadata] Error:', errorMsg);
            }
        };

        fetchMetadata();
    }, [currentFile?.id]);

    // Cleanup en unmount
    useEffect(() => {
        return () => {
            if (lastCoverUrlRef.current) {
                URL.revokeObjectURL(lastCoverUrlRef.current);
                console.log('[useNowPlayingMetadata] Blob URL cleaned up');
            }
        };
    }, []);

    return metadata;
}

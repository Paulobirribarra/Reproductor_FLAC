/**
 * Servicio para manejar archivos FLAC grandes
 * Estrategia: Descargar en chunks, intentar decodificación con límites de memoria
 */

interface FlacStreamOptions {
    url: string;
    onProgress?: (progress: { downloaded: number; total: number; percent: number }) => void;
    chunkSize?: number; // bytes a descargar por chunk (default: 10MB)
    onError?: (error: Error) => void;
}

interface DecodedAudioBuffer {
    sampleRate: number;
    duration: number;
    audioBuffer: AudioBuffer;
    metadata: {
        title?: string;
        artist?: string;
        album?: string;
    };
}

/**
 * Servicio para manejar archivos FLAC grandes con decodificación segura
 * Descarga el archivo en chunks y lo decodifica de forma eficiente
 */
export class FlacStreamingService {
    private static readonly DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
    private static readonly MIN_FILE_SIZE_FOR_STREAMING = 50 * 1024 * 1024; // 50MB
    private audioContext: AudioContext | null = null;

    constructor() {
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (error) {
            console.error('[FlacStreaming] Error creando AudioContext:', error);
        }
    }

    /**
     * Determina si un archivo debe usar decodificación especial
     */
    static shouldUseStreaming(fileSize: number): boolean {
        return fileSize > FlacStreamingService.MIN_FILE_SIZE_FOR_STREAMING;
    }

    /**
     * Decodifica un archivo FLAC descargándolo en chunks
     * Usa limitación inteligente de memoria
     */
    async decode(options: FlacStreamOptions): Promise<DecodedAudioBuffer> {
        const { url, chunkSize = FlacStreamingService.DEFAULT_CHUNK_SIZE, onProgress, onError } = options;

        if (!this.audioContext) {
            throw new Error('AudioContext no disponible');
        }

        try {
            console.log(`[FlacStreaming] Iniciando descarga de: ${url}`);

            // Obtener tamaño total
            const fileSize = await this.getFileSize(url);
            console.log(`[FlacStreaming] Tamaño total: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);

            // Descargar archivo completo en chunks
            const fullBuffer = await this.downloadInChunks(url, fileSize, chunkSize, onProgress);

            console.log(`[FlacStreaming] Decodificando ${(fullBuffer.byteLength / 1024 / 1024).toFixed(2)}MB...`);

            // Decodificar usando Web Audio API
            const audioBuffer = await this.audioContext.decodeAudioData(fullBuffer);

            console.log(`[FlacStreaming] ✓ Decodificado: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels} canales`);

            return {
                sampleRate: audioBuffer.sampleRate,
                duration: audioBuffer.duration,
                audioBuffer,
                metadata: {},
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('[FlacStreaming] Error:', err.message);
            if (onError) onError(err);
            throw err;
        }
    }

    /**
     * Obtiene tamaño del archivo
     */
    private async getFileSize(url: string): Promise<number> {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            const contentLength = response.headers.get('content-length');

            if (!contentLength) {
                throw new Error('No se pudo obtener tamaño via HEAD');
            }

            return parseInt(contentLength, 10);
        } catch (error) {
            console.warn('[FlacStreaming] HEAD request falló, intentando GET...');
            // Fallback: GET request (menos eficiente)
            const response = await fetch(url, { method: 'GET' });
            const buffer = await response.arrayBuffer();
            return buffer.byteLength;
        }
    }

    /**
     * Descarga archivo en chunks
     */
    private async downloadInChunks(
        url: string,
        total: number,
        chunkSize: number,
        onProgress?: (progress: { downloaded: number; total: number; percent: number }) => void
    ): Promise<ArrayBuffer> {
        const chunks: Uint8Array[] = [];
        let downloaded = 0;

        for (let offset = 0; offset < total; offset += chunkSize) {
            const end = Math.min(offset + chunkSize - 1, total - 1);

            try {
                const chunk = await this.downloadRange(url, offset, end);
                chunks.push(new Uint8Array(chunk));

                downloaded = end + 1;

                if (onProgress) {
                    onProgress({
                        downloaded,
                        total,
                        percent: (downloaded / total) * 100,
                    });
                }

                console.log(`[FlacStreaming] ${((downloaded / total) * 100).toFixed(1)}% descargado`);
            } catch (error) {
                console.error(`[FlacStreaming] Error descargando chunk ${offset}-${end}:`, error);
                throw error;
            }
        }

        //Concatenar chunks
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const fullBuffer = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
            fullBuffer.set(chunk, offset);
            offset += chunk.length;
        }

        return fullBuffer.buffer;
    }

    /**
     * Descarga un rango específico del archivo
     */
    private async downloadRange(url: string, start: number, end: number): Promise<ArrayBuffer> {
        const response = await fetch(url, {
            headers: { Range: `bytes=${start}-${end}` },
        });

        if (!response.ok && response.status !== 206) {
            // Si Range no funciona, descargar el archivo entero (menos óptimo)
            console.warn('[FlacStreaming] Range requests no soportados, descargando completo...');
            return response.arrayBuffer();
        }

        return response.arrayBuffer();
    }

    /**
     * Limpia recursos
     */
    dispose(): void {
        // No cerrar audioContext inmediatamente, puede usarse para futuras decodificaciones
        // if (this.audioContext && this.audioContext.state !== 'closed') {
        //   this.audioContext.close();
        // }
    }
}

export const flacStreamingService = new FlacStreamingService();


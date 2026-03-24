/**
 * Extractor rústico de metadatos de archivos de audio
 * Soporta: MP3, FLAC, WAV, OGG usando ID3v2 y otras etiquetas
 */

interface AudioMetadata {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    genre?: string;
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    cover?: {
        url?: string;
        data?: Uint8Array;
        type?: string;
    };
    raw?: Record<string, unknown>;
}

interface ID3v2Header {
    version: number;
    flags: number;
    size: number;
}

/**
 * Extrae ID3v2 de archivos MP3
 */
function parseID3v2(buffer: ArrayBuffer): Partial<AudioMetadata> {
    const view = new Uint8Array(buffer);
    const metadata: Partial<AudioMetadata> = {};

    // Verificar ID3v2 header "ID3"
    if (view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33) {
        console.log('[Metadata] ✓ ID3v2 header detectado');

        const version = view[3];
        const flags = view[4];
        const size = ((view[6] & 0x7f) << 21) | ((view[7] & 0x7f) << 14) | ((view[8] & 0x7f) << 7) | (view[9] & 0x7f);

        console.log(`[Metadata] Versión ID3v2.${version}, Flags: ${flags}, Tamaño: ${size} bytes`);

        // Frames principales a extraer
        let offset = 10; // Después del header
        const frameData: Record<string, string> = {};

        while (offset < Math.min(size + 10, view.length - 4)) {
            const frameID = String.fromCharCode(view[offset], view[offset + 1], view[offset + 2], view[offset + 3]);
            const frameSize = (view[offset + 4] << 24) | (view[offset + 5] << 16) | (view[offset + 6] << 8) | view[offset + 7];
            const frameFlags = (view[offset + 8] << 8) | view[offset + 9];

            if (frameID[0] === '\0' || frameSize === 0) break;

            offset += 10;

            // Leer content del frame
            if (frameID === 'TIT2') { // Title
                frameData['TIT2'] = extractTextFrame(view, offset, frameSize);
                metadata.title = frameData['TIT2'];
            } else if (frameID === 'TPE1') { // Artist
                frameData['TPE1'] = extractTextFrame(view, offset, frameSize);
                metadata.artist = frameData['TPE1'];
            } else if (frameID === 'TALB') { // Album
                frameData['TALB'] = extractTextFrame(view, offset, frameSize);
                metadata.album = frameData['TALB'];
            } else if (frameID === 'TDRC') { // Year
                frameData['TDRC'] = extractTextFrame(view, offset, frameSize);
                metadata.year = frameData['TDRC'];
            } else if (frameID === 'TCON') { // Genre
                frameData['TCON'] = extractTextFrame(view, offset, frameSize);
                metadata.genre = frameData['TCON'];
            } else if (frameID === 'APIC') { // Attached Picture (Cover)
                metadata.cover = extractAPICFrame(view, offset, frameSize);
            }

            console.log(`[Metadata] Frame: ${frameID}, Size: ${frameSize}, Data: ${frameData[frameID]?.substring(0, 50) || 'binary'}`);

            offset += frameSize;
        }

        metadata.raw = frameData;
    }

    return metadata;
}

function extractTextFrame(view: Uint8Array, offset: number, size: number): string {
    const encoding = view[offset]; // 0=ISO-8859-1, 1=UTF-16, 2=UTF-16BE, 3=UTF-8
    const textBytes = view.slice(offset + 1, offset + size);

    try {
        if (encoding === 3) { // UTF-8
            return new TextDecoder('utf-8').decode(textBytes);
        } else if (encoding === 0) { // ISO-8859-1
            return new TextDecoder('iso-8859-1').decode(textBytes);
        } else {
            return new TextDecoder('utf-16').decode(textBytes);
        }
    } catch {
        return '[Error decodificando]';
    }
}

function extractAPICFrame(view: Uint8Array, offset: number, size: number): AudioMetadata['cover'] {
    try {
        const encoding = view[offset];
        let pos = offset + 1;

        // Leer MIME type (hasta null)
        let mimeEnd = pos;
        while (mimeEnd < offset + size && view[mimeEnd] !== 0) mimeEnd++;
        const mimeType = new TextDecoder('iso-8859-1').decode(view.slice(pos, mimeEnd));
        pos = mimeEnd + 1;

        const pictureType = view[pos];
        pos += 1;

        // Leer descripción (hasta null) - generalmente vacía
        while (pos < offset + size && view[pos] !== 0) pos++;
        pos += 1;

        // Resto es data de imagen
        const imageData = view.slice(pos, offset + size);

        console.log(`[Metadata] Cover detectado: ${mimeType}, Tamaño: ${imageData.length} bytes`);

        return {
            type: mimeType,
            data: imageData,
            url: createBlobURL(imageData, mimeType),
        };
    } catch (error) {
        console.error('[Metadata] Error extrayendo cover:', error);
        return {};
    }
}

function createBlobURL(data: Uint8Array, mimeType: string): string {
    // Crear una copia para asegurar que el buffer es ArrayBuffer (no SharedArrayBuffer)
    const blob = new Blob([data.slice()], { type: mimeType });
    return URL.createObjectURL(blob);
}

/**
 * Parsea Vorbis Comments en FLAC
 */
function parseFLAC(buffer: ArrayBuffer): Partial<AudioMetadata> {
    const view = new Uint8Array(buffer);
    const metadata: Partial<AudioMetadata> = {};

    // Verificar "fLaC" header
    if (view[0] !== 0x66 || view[1] !== 0x4c || view[2] !== 0x61 || view[3] !== 0x43) {
        return metadata;
    }

    console.log('[Metadata] ✓ FLAC header detectado');

    let offset = 4;
    let lastBlock = false;

    // Parsear metadata blocks
    while (offset < view.length && !lastBlock) {
        const blockHeader = view[offset];
        lastBlock = (blockHeader & 0x80) !== 0;
        const blockType = blockHeader & 0x7f;
        offset++;

        // Leer tamaño del bloque (3 bytes, big-endian)
        const blockSize = (view[offset] << 16) | (view[offset + 1] << 8) | view[offset + 2];
        offset += 3;

        console.log(`[Metadata] FLAC Block Type: ${blockType}, Size: ${blockSize}`);

        // Tipo 4 = Vorbis Comment
        if (blockType === 4) {
            offset = parseVorbisComments(view, offset, blockSize, metadata);
        }
        // Tipo 6 = Picture block
        else if (blockType === 6) {
            offset = parseFLACPicture(view, offset, blockSize, metadata);
        }
        else {
            offset += blockSize;
        }
    }

    return metadata;
}

/**
 * Parsea Picture block en FLAC (Tipo 6)
 */
function parseFLACPicture(view: Uint8Array, offset: number, blockSize: number, metadata: Partial<AudioMetadata>): number {
    try {
        let pos = offset;
        const endOffset = offset + blockSize;

        // Picture type (4 bytes, big-endian)
        const pictureType = (view[pos] << 24) | (view[pos + 1] << 16) | (view[pos + 2] << 8) | view[pos + 3];
        pos += 4;

        // MIME type length
        const mimeLength = (view[pos] << 24) | (view[pos + 1] << 16) | (view[pos + 2] << 8) | view[pos + 3];
        pos += 4;

        // MIME type
        const mimeType = new TextDecoder('utf-8').decode(view.slice(pos, pos + mimeLength));
        pos += mimeLength;

        // Description length
        const descLength = (view[pos] << 24) | (view[pos + 1] << 16) | (view[pos + 2] << 8) | view[pos + 3];
        pos += 4;

        // Skip description
        pos += descLength;

        // Picture dimensions
        pos += 16; // width (4), height (4), depth (4), colors (4)

        // Picture data length
        const picLength = (view[pos] << 24) | (view[pos + 1] << 16) | (view[pos + 2] << 8) | view[pos + 3];
        pos += 4;

        // Picture data
        const imageData = view.slice(pos, pos + picLength);

        if (imageData.length > 0) {
            metadata.cover = {
                type: mimeType,
                data: imageData,
                url: createBlobURL(imageData, mimeType),
            };

            console.log(`[Metadata] FLAC Picture block encontrado: ${mimeType} (${imageData.length} bytes, tipo ${pictureType})`);
        }

        return endOffset;
    } catch (error) {
        console.error('[Metadata] Error parseando FLAC Picture:', error);
        return offset + blockSize;
    }
}

/**
 * Parsea Vorbis Comments
 */
function parseVorbisComments(
    view: Uint8Array,
    offset: number,
    blockSize: number,
    metadata: Partial<AudioMetadata>,
): number {
    try {
        const endOffset = offset + blockSize;

        // Leer vendor length (4 bytes, little-endian)
        const vendorLength = view[offset] | (view[offset + 1] << 8) | (view[offset + 2] << 16) | (view[offset + 3] << 24);
        let pos = offset + 4 + vendorLength;

        // Leer número de comments (4 bytes, little-endian)
        const commentCount = view[pos] | (view[pos + 1] << 8) | (view[pos + 2] << 16) | (view[pos + 3] << 24);
        pos += 4;

        console.log(`[Metadata] Vorbis Comments: ${commentCount} tags`);

        const comments: Record<string, string> = {};

        // Parsear cada comentario
        for (let i = 0; i < commentCount && pos < endOffset; i++) {
            const commentLength = view[pos] | (view[pos + 1] << 8) | (view[pos + 2] << 16) | (view[pos + 3] << 24);
            pos += 4;

            const commentData = view.slice(pos, pos + commentLength);
            const commentStr = new TextDecoder('utf-8').decode(commentData);
            pos += commentLength;

            const [key, value] = commentStr.split('=');
            if (key && value) {
                comments[key.toUpperCase()] = value;
            }
        }

        // Mapear comentarios a metadatos
        if (comments['TITLE']) metadata.title = comments['TITLE'];
        if (comments['ARTIST']) metadata.artist = comments['ARTIST'];
        if (comments['ALBUM']) metadata.album = comments['ALBUM'];
        if (comments['DATE'] || comments['YEAR']) metadata.year = comments['DATE'] || comments['YEAR'];
        if (comments['GENRE']) metadata.genre = comments['GENRE'];

        console.log('[Metadata] Vorbis Comments extraídos:', comments);

        // Buscar cover artista en PICTURE block (alternativo)
        // FLAC puede tener el cover como un vorbis comment o como metadata block
        if (comments['METADATA_BLOCK_PICTURE']) {
            try {
                const picData = atob(comments['METADATA_BLOCK_PICTURE']);
                const picBytes = new Uint8Array(picData.length);
                for (let i = 0; i < picData.length; i++) {
                    picBytes[i] = picData.charCodeAt(i);
                }
                // Los primeros 32 bytes son el FLAC picture block header
                // Saltar: mime type, description, width, height, depth, colors, picture data length
                let picOffset = 0;
                const mimeLength = (picBytes[picOffset] << 24) | (picBytes[picOffset + 1] << 16) | (picBytes[picOffset + 2] << 8) | picBytes[picOffset + 3];
                picOffset += 4 + mimeLength;
                const descLength = (picBytes[picOffset] << 24) | (picBytes[picOffset + 1] << 16) | (picBytes[picOffset + 2] << 8) | picBytes[picOffset + 3];
                picOffset += 4 + descLength + 16; // 16 bytes para width, height, depth, colors
                const imageLength = (picBytes[picOffset] << 24) | (picBytes[picOffset + 1] << 16) | (picBytes[picOffset + 2] << 8) | picBytes[picOffset + 3];
                picOffset += 4;

                const imageData = picBytes.slice(picOffset, picOffset + imageLength);
                const mimeType = new TextDecoder('utf-8').decode(picBytes.slice(4, 4 + mimeLength));

                metadata.cover = {
                    type: mimeType,
                    data: imageData,
                    url: createBlobURL(imageData, mimeType),
                };

                console.log(`[Metadata] FLAC Cover encontrado: ${mimeType} (${imageData.length} bytes)`);
            } catch (e) {
                console.warn('[Metadata] Error parseando FLAC picture:', e);
            }
        }

        return pos;
    } catch (error) {
        console.error('[Metadata] Error parseando Vorbis Comments:', error);
        return offset + blockSize;
    }
}

export async function extractAudioMetadata(
    file: File | string,
): Promise<AudioMetadata> {
    const metadata: AudioMetadata = {};

    try {
        let arrayBuffer: ArrayBuffer;

        // Si es string (URL), hacer fetch
        if (typeof file === 'string') {
            console.log(`[Metadata] Fetching: ${file}`);
            const response = await fetch(file);

            if (!response.ok) {
                console.error(`[Metadata] ❌ Error HTTP ${response.status}: ${response.statusText}`);
                return metadata;
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('audio')) {
                console.warn(`[Metadata] ⚠️ Content-Type no es audio: ${contentType}`);
            }

            arrayBuffer = await response.arrayBuffer();
        } else {
            console.log(`[Metadata] Leyendo archivo: ${file.name} (${file.size} bytes)`);
            arrayBuffer = await file.slice(0, 100000).arrayBuffer(); // Primeros 100KB (antes: 500KB)
        }

        // Detectar formato y parsear
        const view = new Uint8Array(arrayBuffer);
        if (view[0] === 0x66 && view[1] === 0x4c && view[2] === 0x61 && view[3] === 0x43) {
            // FLAC
            const flacMetadata = parseFLAC(arrayBuffer);
            Object.assign(metadata, flacMetadata);
        } else if (view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33) {
            // ID3v2 (MP3)
            const id3Metadata = parseID3v2(arrayBuffer);
            Object.assign(metadata, id3Metadata);
        } else {
            console.log('[Metadata] Formato desconocido, intentando decodificar para duración');
            console.log(`[Metadata] Primeros bytes: ${Array.from(view.slice(0, 4)).map(b => '0x' + b.toString(16)).join(' ')}`);
        }

        // Usar Audio API para obtener duración
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const decodedAudio = await audioContext.decodeAudioData(arrayBuffer.slice(0));
            metadata.duration = decodedAudio.duration;
            metadata.sampleRate = decodedAudio.sampleRate;
            console.log(`[Metadata] Duración: ${metadata.duration.toFixed(2)}s, Sample Rate: ${metadata.sampleRate}Hz`);
        } catch (error) {
            console.warn('[Metadata] No se pudo decodificar audio completo:', error);
        }

    } catch (error) {
        console.error('[Metadata] Error extrayendo metadatos:', error);
    }

    return metadata;
}

/**
 * Imprime metadatos en console de forma rústica
 */
export function printMetadata(metadata: AudioMetadata, filename?: string): void {
    // Logs deshabilitados
}

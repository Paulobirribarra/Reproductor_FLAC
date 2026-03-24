import path from 'path';
import fs from 'fs/promises';

export class MetadataService {
    constructor(uploadDir) {
        this.uploadDir = uploadDir;
    }

    /**
     * Extrae metadatos de un archivo FLAC
     */
    extractFLACMetadata(buffer) {
        const view = new Uint8Array(buffer);
        const metadata = {};

        // Verificar "fLaC" header
        if (view[0] !== 0x66 || view[1] !== 0x4c || view[2] !== 0x61 || view[3] !== 0x43) {
            return null;
        }

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

            // Tipo 4 = Vorbis Comment
            if (blockType === 4) {
                this.parseVorbisComments(view, offset, blockSize, metadata);
            }
            // Tipo 6 = Picture block
            else if (blockType === 6) {
                this.parseFLACPicture(view, offset, blockSize, metadata);
            }

            offset += blockSize;
        }

        return metadata;
    }

    /**
     * Parsea Picture block en FLAC (Tipo 6)
     */
    parseFLACPicture(view, offset, blockSize, metadata) {
        try {
            let pos = offset;

            // Picture type (4 bytes, big-endian)
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

            // Skip dimensions (16 bytes)
            pos += 16;

            // Picture data length
            const picLength = (view[pos] << 24) | (view[pos + 1] << 16) | (view[pos + 2] << 8) | view[pos + 3];
            pos += 4;

            // Picture data
            const imageData = view.slice(pos, pos + picLength);

            if (imageData.length > 0) {
                metadata.hasCover = true;
                metadata.coverMimeType = mimeType;
                metadata.coverSize = imageData.length;
                // No guardamos los bytes aquí, solo metadatos
                console.log(`[MetadataService] Picture encontrada: ${mimeType} (${imageData.length} bytes)`);
            }
        } catch (error) {
            console.error('[MetadataService] Error parseando Picture:', error);
        }
    }

    /**
     * Parsea Vorbis Comments
     */
    parseVorbisComments(view, offset, blockSize, metadata) {
        try {
            const endOffset = offset + blockSize;

            // Leer vendor length (4 bytes, little-endian)
            const vendorLength = view[offset] | (view[offset + 1] << 8) | (view[offset + 2] << 16) | (view[offset + 3] << 24);
            let pos = offset + 4 + vendorLength;

            // Leer número de comments (4 bytes, little-endian)
            const commentCount = view[pos] | (view[pos + 1] << 8) | (view[pos + 2] << 16) | (view[pos + 3] << 24);
            pos += 4;

            const comments = {};

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
        } catch (error) {
            console.error('[MetadataService] Error parseando Vorbis:', error);
        }
    }

    /**
     * Extrae metadatos de un archivo por ruta
     */
    async getMetadata(filePath) {
        try {
            const fullPath = path.join(this.uploadDir, filePath);

            // Validar que la ruta esté dentro de uploadDir
            const resolved = path.resolve(fullPath);
            const uploadsResolved = path.resolve(this.uploadDir);
            if (!resolved.startsWith(uploadsResolved)) {
                throw new Error('Acceso denegado: ruta fuera de uploadDir');
            }

            const stats = await fs.stat(fullPath);
            if (!stats.isFile()) {
                throw new Error('No es un archivo');
            }

            // Leer primeros 500KB para metadatos
            const buffer = Buffer.alloc(500000);
            const fd = await fs.open(fullPath, 'r');
            const { bytesRead } = await fd.read(buffer, 0, 500000, 0);
            await fd.close();

            const actualBuffer = buffer.slice(0, bytesRead);

            // Detectar formato
            const ext = path.extname(fullPath).toLowerCase();
            let metadata = { extension: ext, size: stats.size };

            if (ext === '.flac') {
                const flacMeta = this.extractFLACMetadata(actualBuffer);
                if (flacMeta) {
                    metadata = { ...metadata, ...flacMeta };
                }
            } else if (ext === '.mp3') {
                // TODO: Implementar ID3v2 en backend si es necesario
                metadata.note = 'MP3 parsing not yet implemented in backend';
            }

            metadata.path = filePath;
            metadata.timestamp = new Date().toISOString();

            return metadata;
        } catch (error) {
            console.error('[MetadataService] Error:', error.message);
            throw error;
        }
    }
}

export function createMetadataService(uploadDir) {
    return new MetadataService(uploadDir);
}

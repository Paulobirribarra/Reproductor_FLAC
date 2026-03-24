import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export class FlacSplitService {
    static SPLIT_THRESHOLD = 200 * 1024 * 1024;
    static CHUNK_TARGET_SIZE = 100 * 1024 * 1024;

    static shouldSplit(fileSize) {
        return fileSize > FlacSplitService.SPLIT_THRESHOLD;
    }

    async splitFlac(inputPath, outputDir, baseFileName) {
        try {
            console.log(`[FlacSplit] Iniciando split: ${baseFileName}`);

            await this.checkFfmpegAvailable();

            const duration = await this.getFlacDuration(inputPath);
            console.log(`[FlacSplit] Duración: ${(duration / 60).toFixed(2)} min`);

            const numChunks = Math.ceil(duration / this.getTargetDuration(duration));
            const chunkDuration = duration / numChunks;

            console.log(`[FlacSplit] Creating ${numChunks} chunks`);

            const chunks = [];
            for (let i = 0; i < numChunks; i++) {
                const startTime = i * chunkDuration;
                const endTime = (i + 1) * chunkDuration;
                const duration_chunk = endTime - startTime;

                const chunkFileName = `${baseFileName}_pt${i + 1}.flac`;
                const chunkPath = path.join(outputDir, chunkFileName);

                await this.extractFlacSegment(inputPath, chunkPath, startTime, duration_chunk);

                const stats = await fs.stat(chunkPath);
                chunks.push({
                    name: chunkFileName,
                    path: chunkFileName,
                    originalName: chunkFileName,
                    size: stats.size,
                    uploadedAt: new Date().toISOString(),
                    isChunk: true,
                    chunkIndex: i,
                    totalChunks: numChunks,
                    originalFileName: baseFileName,
                });

                console.log(`[FlacSplit] Chunk ${i + 1}/${numChunks}: ${(chunks[i].size / 1024 / 1024).toFixed(2)}MB`);
            }

            console.log(`[FlacSplit] ✓ Split completado: ${numChunks} chunks`);

            try {
                await fs.unlink(inputPath);
                console.log(`[FlacSplit] Archivo original eliminado`);
            } catch (error) {
                console.warn(`[FlacSplit] No se pudo eliminar original`);
            }

            return chunks;
        } catch (error) {
            console.error(`[FlacSplit] Error:`, error.message);
            throw new Error(`Split failed: ${error.message}`);
        }
    }

    async checkFfmpegAvailable() {
        try {
            await execAsync('ffmpeg -version', { timeout: 5000 });
        } catch (error) {
            throw new Error('ffmpeg not installed');
        }
    }

    async getFlacDuration(filePath) {
        try {
            const { stdout } = await execAsync(
                `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
                { timeout: 30000 }
            );
            return parseFloat(stdout.trim());
        } catch (error) {
            throw new Error(`Cannot get duration: ${error.message}`);
        }
    }

    getTargetDuration(totalDuration) {
        const baseLineDuration = 420; // 7 minutos

        if (totalDuration < 1800) {
            return totalDuration;
        }

        return baseLineDuration;
    }

    async extractFlacSegment(inputPath, outputPath, startTime, duration) {
        try {
            const cmd = `ffmpeg -i "${inputPath}" -ss ${startTime.toFixed(2)} -t ${duration.toFixed(2)} -c:a flac -q:a 8 "${outputPath}" -y`;
            await execAsync(cmd, { timeout: 600000 });
        } catch (error) {
            throw new Error(`Segment extraction failed: ${error.message}`);
        }
    }
}

export const flacSplitService = new FlacSplitService();

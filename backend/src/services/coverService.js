import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import Redis from 'ioredis';

const execAsync = promisify(exec);

export class CoverService {
  constructor(uploadDir, coversDir = null) {
    this.uploadDir = uploadDir;
    // Directorio donde se guardan los thumbnails WebP
    this.coversDir = coversDir || path.join(uploadDir, '.covers_cache');
    
    // Conexión exclusiva a DB 2 para no colisionar con DB 0 (audio) ni DB 5 (facturas)
    const baseRedisUrl = process.env.REDIS_URL || 'redis://db_redis:6379/0';
    // Reemplazamos la base de datos al final de la URL por /2
    const coverRedisUrl = baseRedisUrl.replace(/\/\d+$/, '/2');

    this.redis = new Redis(coverRedisUrl, {
      keyPrefix: 'cover:',
      retryStrategy: (times) => Math.min(times * 100, 3000),
      maxRetriesPerRequest: null,
    });

    this.redis.on('connect', () => {
      console.log('[CoverService] Conectado a Redis en DB 2 para caché de carátulas');
    });

    this.redis.on('error', (err) => {
      console.warn('[CoverService] Redis warning:', err.message);
    });

    this.initCoversDir();
  }

  async initCoversDir() {
    try {
      await fs.mkdir(this.coversDir, { recursive: true });
    } catch (e) {
      console.error('[CoverService] Error creando carpeta covers:', e.message);
    }
  }

  /**
   * Genera un hash seguro y consistente para una carpeta
   */
  getFolderHash(folderPath) {
    return crypto.createHash('md5').update(folderPath.toLowerCase().trim()).digest('hex');
  }

  /**
   * Obtiene la ruta física del thumbnail WebP para una carpeta
   */
  async getCover(folderPath) {
    const normalizedFolder = folderPath ? folderPath.replace(/\//g, path.sep) : '';
    const fullFolderPath = path.join(this.uploadDir, normalizedFolder);

    const folderHash = this.getFolderHash(folderPath);
    const thumbFileName = `${folderHash}.webp`;
    const thumbFullPath = path.join(this.coversDir, thumbFileName);

    // 1. Revisar si el thumbnail ya existe en disco
    try {
      await fs.access(thumbFullPath);
      return { path: thumbFullPath, mimeType: 'image/webp' };
    } catch (e) {
      // No existe en disco, proceder a búsqueda/generación
    }

    // 2. Revisar si Redis ya tiene indexada la información
    let cachedInfo = null;
    try {
      const cached = await this.redis.get(`folder:${folderHash}`);
      if (cached) {
        cachedInfo = JSON.parse(cached);
      }
    } catch (err) {
      // Ignorar fallo puntual de Redis
    }

    // 3. Buscar fuente de la portada (imagen suelta o FLAC/MP3 incrustado)
    let sourcePath = null;

    if (cachedInfo?.sourcePath && existsSync(cachedInfo.sourcePath)) {
      sourcePath = cachedInfo.sourcePath;
    } else {
      sourcePath = await this.findCoverSource(fullFolderPath);
      if (sourcePath) {
        // Guardar fuente en Redis DB 2
        try {
          await this.redis.set(
            `folder:${folderHash}`,
            JSON.stringify({ folder: folderPath, sourcePath, updatedAt: Date.now() })
          );
        } catch (e) {}
      }
    }

    if (!sourcePath) {
      return null;
    }

    // 4. Generar thumbnail WebP con ffmpeg (150x150 manteniendo aspect ratio)
    try {
      await fs.mkdir(this.coversDir, { recursive: true });
      const cmd = `ffmpeg -y -i "${sourcePath}" -an -vf "scale=150:150:force_original_aspect_ratio=decrease" -q:v 80 -update 1 "${thumbFullPath}" 2>/dev/null`;
      await execAsync(cmd);

      return { path: thumbFullPath, mimeType: 'image/webp' };
    } catch (err) {
      console.error(`[CoverService] Error generando thumbnail para "${folderPath}":`, err.message);
      return null;
    }
  }

  /**
   * Busca si hay una imagen suelta o un archivo de audio con portada incrustada
   */
  async findCoverSource(fullFolderPath) {
    try {
      const items = await fs.readdir(fullFolderPath);

      // Prioridad 1: Imagen suelta común (cover.jpg, folder.jpg, front.jpg, etc.)
      const priorityImage = items.find(f => /^(cover|folder|front|albumart)\.(jpg|jpeg|png|webp)$/i.test(f));
      if (priorityImage) {
        return path.join(fullFolderPath, priorityImage);
      }

      // Prioridad 2: Cualquier otra imagen jpg/png
      const anyImage = items.find(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
      if (anyImage) {
        return path.join(fullFolderPath, anyImage);
      }

      // Prioridad 3: Archivo de audio para extraer portada incrustada (FLAC primero, luego MP3)
      const audioFiles = items.filter(f => /\.(flac|mp3)$/i.test(f));
      if (audioFiles.length > 0) {
        // Seleccionamos el primer track
        return path.join(fullFolderPath, audioFiles[0]);
      }

      // Prioridad 4: Si es una carpeta de artista (solo tiene subcarpetas), buscar recursivamente en el primer álbum
      for (const item of items) {
        const subPath = path.join(fullFolderPath, item);
        try {
          const stat = await fs.stat(subPath);
          if (stat.isDirectory() && !item.startsWith('.')) {
            const nestedSource = await this.findCoverSource(subPath);
            if (nestedSource) {
              return nestedSource;
            }
          }
        } catch (e) {}
      }
    } catch (e) {
      // Directorio no accesible
    }

    return null;
  }
}

let coverServiceInstance = null;

export function getCoverService(uploadDir) {
  if (!coverServiceInstance) {
    coverServiceInstance = new CoverService(uploadDir);
  }
  return coverServiceInstance;
}

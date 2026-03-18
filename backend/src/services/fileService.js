import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class FileService {
  constructor(uploadDir) {
    this.uploadDir = uploadDir;
  }

  async ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  // Normalizar rutas del frontend (/ a separador del SO)
  normalizePath(filePath) {
    return filePath ? filePath.replace(/\//g, path.sep) : '';
  }

  async getRelativePath(fullPath) {
    return path.relative(this.uploadDir, fullPath);
  }

  async listFiles(folder = '') {
    try {
      // Normalizar la ruta: convertir / a separador del SO (solo si hay contenido)
      let folderPath;
      if (folder) {
        const normalizedFolder = folder.replace(/\//g, path.sep);
        folderPath = path.join(this.uploadDir, normalizedFolder);
        console.log(`[FileService] Listando carpeta: "${folder}" → normalizada: "${normalizedFolder}" → path: "${folderPath}"`);
      } else {
        folderPath = this.uploadDir;
        console.log(`[FileService] Listando raíz: "${folderPath}"`);
      }

      await this.ensureDir(folderPath);

      const items = await fs.readdir(folderPath, { withFileTypes: true });
      console.log(`[FileService] Found ${items.length} items in "${folder || 'root'}"`);
      const fileInfos = [];
      const folders = [];

      for (const item of items) {
        const itemPath = path.join(folderPath, item.name);
        // Normalizar con / para consistencia en JSON
        const fullPath = path.relative(this.uploadDir, itemPath).replace(/\\/g, '/');

        if (item.isDirectory()) {
          console.log(`[FileService] 📁 Carpeta encontrada: ${item.name} → path: ${fullPath}`);
          folders.push({
            type: 'folder',
            name: item.name,
            path: fullPath,
          });
        } else {
          try {
            const stats = await fs.stat(itemPath);
            console.log(`[FileService] 📄 Archivo encontrado: ${item.name} (${stats.size} bytes) → path: ${fullPath}`);
            fileInfos.push({
              type: 'file',
              id: item.name.replace(/\.[^.]+$/, ''),
              name: item.name,
              originalName: item.name,
              size: stats.size,
              uploadedAt: stats.birthtime.toISOString(),
              path: fullPath,
            });
          } catch (err) {
            console.error(`Error reading file ${item.name}:`, err);
          }
        }
      }

      console.log(`[FileService] Resumen: ${fileInfos.length} archivos, ${folders.length} carpetas`);
      return {
        files: fileInfos,
        folders: folders,
        currentPath: folder || '/',
      };
    } catch (error) {
      console.error('Error listing files:', error);
      return { files: [], folders: [], currentPath: folder || '/', error: error.message };
    }
  }

  async createFolder(folderName, parentFolder = '') {
    try {
      const normalizedParent = this.normalizePath(parentFolder);
      const folderPath = normalizedParent
        ? path.join(this.uploadDir, normalizedParent, folderName)
        : path.join(this.uploadDir, folderName);

      // Validar nombre
      if (!this.isValidFolderName(folderName)) {
        throw new Error('Nombre de carpeta inválido');
      }

      await this.ensureDir(folderPath);

      return {
        success: true,
        folder: {
          type: 'folder',
          name: folderName,
          path: parentFolder ? `${parentFolder}/${folderName}` : folderName,
        },
      };
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  async renameFile(filePath, newName) {
    try {
      const normalizedPath = this.normalizePath(filePath);
      const fullPath = path.join(this.uploadDir, normalizedPath);
      const dir = path.dirname(fullPath);
      const newPath = path.join(dir, newName);

      // Validar nombre
      if (!this.isValidFileName(newName)) {
        throw new Error('Nombre de archivo inválido');
      }

      // Verificar que el archivo existe
      await fs.stat(fullPath);

      // Renombrar
      await fs.rename(fullPath, newPath);

      return {
        success: true,
        file: {
          id: newName.replace(/\.[^.]+$/, ''),
          name: newName,
          path: path.dirname(filePath) ? `${path.dirname(filePath).replace(/\\/g, '/')}/${newName}` : newName,
        },
      };
    } catch (error) {
      console.error('Error renaming file:', error);
      throw error;
    }
  }

  async saveFile(file, folder = '') {
    try {
      // Multer ya guardó el archivo con su nombre original en la carpeta destino
      // Solo necesitamos retornar la información del archivo
      const normalizedFolder = this.normalizePath(folder);
      const relativeFolder = normalizedFolder.replace(/\\/g, '/') || '';

      return {
        id: file.originalname.replace(/\.[^.]+$/, ''),
        name: file.originalname,
        originalName: file.originalname,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        path: relativeFolder ? `${relativeFolder}/${file.originalname}` : file.originalname,
      };
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  }

  async deleteFile(filePath) {
    try {
      const normalizedPath = this.normalizePath(filePath);
      const fullPath = path.join(this.uploadDir, normalizedPath);
      await fs.stat(fullPath);
      await fs.unlink(fullPath);
      return { success: true };
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  async deleteFolder(folderPath) {
    try {
      const normalizedPath = this.normalizePath(folderPath);
      const fullPath = path.join(this.uploadDir, normalizedPath);
      await fs.stat(fullPath);
      await fs.rm(fullPath, { recursive: true, force: true });
      return { success: true };
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw error;
    }
  }

  async getFileStream(filePath) {
    try {
      const normalizedPath = this.normalizePath(filePath);
      const fullPath = path.join(this.uploadDir, normalizedPath);
      await fs.stat(fullPath);
      return fullPath;
    } catch (error) {
      console.error('Error getting file stream:', error);
      throw error;
    }
  }

  async moveFile(fileName, fromFolder = '', toFolder = '') {
    try {
      const normalizedFrom = this.normalizePath(fromFolder);
      const normalizedTo = this.normalizePath(toFolder);

      const fromPath = normalizedFrom
        ? path.join(this.uploadDir, normalizedFrom, fileName)
        : path.join(this.uploadDir, fileName);

      const toPath = normalizedTo
        ? path.join(this.uploadDir, normalizedTo, fileName)
        : path.join(this.uploadDir, fileName);

      // Validar que el archivo exista
      await fs.stat(fromPath);

      // Crear carpeta destino si no existe
      if (normalizedTo) {
        await this.ensureDir(path.join(this.uploadDir, normalizedTo));
      }

      // Mover archivo
      await fs.rename(fromPath, toPath);
      return true;
    } catch (error) {
      console.error('Error moving file:', error);
      throw error;
    }
  }

  isValidFileName(name) {
    // No permitir caracteres especiales peligrosos
    const invalidChars = /[<>:"|?*\x00-\x1f]/g;
    return !invalidChars.test(name) && name.length > 0;
  }

  isValidFolderName(name) {
    // No permitir caracteres especiales peligrosos y que no sea un path
    const invalidChars = /[<>:"|?*\x00-\x1f/\\]/g;
    return !invalidChars.test(name) && name.length > 0 && name !== '.' && name !== '..';
  }

  /**
   * Obtener estadísticas del archivo
   * @param {string} filePath - Ruta relativa del archivo
   * @returns {Promise<{size: number, mtimeMs: number}>}
   */
  async getFileStats(filePath) {
    try {
      const normalizedPath = this.normalizePath(filePath);
      const fullPath = path.join(this.uploadDir, normalizedPath);
      const stats = await fs.stat(fullPath);
      return {
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      };
    } catch (error) {
      console.error('Error getting file stats:', error);
      throw error;
    }
  }

  /**
   * Crear stream de lectura con rango específico
   * @param {string} fullPath - Ruta absoluta del archivo
   * @param {number} start - Byte de inicio (inclusive)
   * @param {number} end - Byte de fin (inclusive)
   * @returns {fs.ReadStream}
   */
  createFileStream(fullPath, start = 0, end = null) {
    return createReadStream(fullPath, {
      start,
      end: end !== null ? end : undefined,
      highWaterMark: 65536, // 64KB chunks para mejor performance
    });
  }

  /**
   * Warm-up del archivo: lee los primeros BURST_SIZE bytes para calentar Page Cache
   * @param {string} filePath - Ruta relativa del archivo
   * @param {number} burstSize - Bytes a leer (default: 5MB)
   * @returns {Promise<boolean>}
   */
  async warmupFile(filePath, burstSize = 5 * 1024 * 1024) {
    try {
      const normalizedPath = this.normalizePath(filePath);
      const fullPath = path.join(this.uploadDir, normalizedPath);

      // Obtener tamaño del archivo
      const stats = await fs.stat(fullPath);
      const fileSize = stats.size;

      // Leer los primeros burstSize bytes en bloques para calentar Page Cache
      const chunkSize = Math.min(burstSize, 1024 * 1024); // 1MB chunks
      let bytesRead = 0;

      const fileHandle = await fs.open(fullPath, 'r');

      try {
        while (bytesRead < Math.min(burstSize, fileSize)) {
          const toRead = Math.min(chunkSize, fileSize - bytesRead);
          const buffer = Buffer.alloc(toRead);

          await fileHandle.read(buffer, 0, toRead, bytesRead);
          bytesRead += toRead;
        }
      } finally {
        await fileHandle.close();
      }

      console.log(`[FileService] Warmup completado: ${filePath} (${(bytesRead / 1024 / 1024).toFixed(2)}MB en Page Cache)`);
      return true;
    } catch (error) {
      console.error('Error warming up file:', error);
      return false;
    }
  }
}

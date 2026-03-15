import { promises as fs } from 'fs';
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
}

// backend/src/routes/fileRoutes.js
import express from 'express';
import { flacSplitService } from '../services/flacSplitService.js';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';

export function createFileRoutes(fileService, upload) {
  const router = express.Router();

  // ---------------------------------------------------
  // Listar archivos y carpetas
  // ---------------------------------------------------
  router.get('/', async (req, res) => {
    try {
      const folder = req.query.folder || '';
      const result = await fileService.listFiles(folder);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ---------------------------------------------------
  // Subir archivo (con requestId para logs)
  // ---------------------------------------------------
  router.post('/upload', (req, res, next) => {
    const requestId = `upl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    req.requestId = requestId;
    console.log(`[Upload ${requestId}] Start handling upload request`);
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err.code, err.message);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: `El archivo es demasiado grande. Máximo: 1GB`,
          });
        }
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      console.log(`[Upload ${req.requestId}] Upload request received`);
      if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const folder = req.query.folder || '';
      console.log('[FileRoutes] Saving file to folder:', folder);
      const fileInfo = await fileService.saveFile(req.file, folder);

      // Detectar si el archivo necesita ser dividido
      const isFLAC = req.file.originalname.toLowerCase().endsWith('.flac');
      const shouldSplit = isFLAC && flacSplitService.constructor.shouldSplit(req.file.size);

      if (shouldSplit) {
        console.log(`[FileRoutes] Archivo grande detectado (${(req.file.size / 1024 / 1024).toFixed(2)}MB), iniciando split...`);
        try {
          const uploadDir = fileService.uploadDir;
          const normalizedFolder = folder ? folder.replace(/\\//g, path.sep) : '';
          const fullPath = path.join(uploadDir, normalizedFolder, req.file.originalname);
          const outputDir = path.dirname(fullPath);
          const baseFileName = req.file.originalname.replace(/\\.flac$/i, '');
          const chunks = await flacSplitService.splitFlac(fullPath, outputDir, baseFileName);
          console.log('File split:', chunks);
          res.status(201).json({
            success: true,
            data: chunks,
            message: `Archivo dividido en ${chunks.length} partes para mejor reproducción`,
          });
        } catch (error) {
          console.error('[FileRoutes] Error dividiendo archivo:', error);
          console.warn('[FileRoutes] Retornando archivo original (sin split)');
          res.status(201).json({
            success: true,
            data: fileInfo,
            warning: `No se pudo dividir archivo automáticamente: ${error.message}. Se guardó sin dividir.`,
          });
        }
      } else {
        console.log(`[Upload ${req.requestId}] File uploaded:`, fileInfo);
        res.status(201).json({
          success: true,
          data: Array.isArray(fileInfo) ? fileInfo : [fileInfo],
        });
      }
    } catch (error) {
      console.error('Error in upload:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ---------------------------------------------------
  // Crear carpeta
  // ---------------------------------------------------
  router.post('/folders', async (req, res) => {
    try {
      const { folderName, parentFolder } = req.body;
      if (!folderName) {
        return res.status(400).json({ success: false, error: 'El nombre de la carpeta es requerido' });
      }
      const result = await fileService.createFolder(folderName, parentFolder || '');
      res.status(201).json(result);
    } catch (error) {
      console.error('Error Creando Carpeta:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // ---------------------------------------------------
  // Eliminar carpeta (antes de eliminar archivo para evitar conflictos)
  // ---------------------------------------------------
  router.delete('/folders/:folderPath', async (req, res) => {
    try {
      const { folderPath } = req.params;
      if (!folderPath) {
        return res.status(400).json({ success: false, error: 'Folder path is required' });
      }
      await fileService.deleteFolder(folderPath);
      res.json({ success: true, message: 'Folder deleted successfully' });
    } catch (error) {
      console.error('Error deleting folder:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // ---------------------------------------------------
  // Renombrar archivo
  // ---------------------------------------------------
  router.patch('/:fileName/rename', async (req, res) => {
    try {
      const { fileName } = req.params;
      const { newName, currentFolder } = req.body;
      const decodedFileName = decodeURIComponent(fileName);
      if (!newName) {
        return res.status(400).json({ success: false, error: 'El nuevo nombre es requerido' });
      }
      const filePath = currentFolder ? `${currentFolder}/${decodedFileName}` : decodedFileName;
      const result = await fileService.renameFile(filePath, newName);
      res.json(result);
    } catch (error) {
      console.error('Error Renombrando Archivo:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // ---------------------------------------------------
  // Descargar/reproducir archivo con Range Requests (RFC 7233)
  // ---------------------------------------------------
  router.get('/:fileName/stream', async (req, res) => {
    try {
      const { fileName } = req.params;
      const folder = req.query.folder || '';
      const decodedFileName = decodeURIComponent(fileName);
      console.log('Stream request - fileName:', fileName);
      console.log('Stream request - decodedFileName:', decodedFileName);
      console.log('Stream request - folder:', folder);

      const filePath = folder ? `${folder}/${decodedFileName}` : decodedFileName;
      console.log('Stream request - filePath:', filePath);

      const fullPath = await fileService.getFileStream(filePath);
      console.log('Stream request - fullPath:', fullPath);

      // Determinar Content-Type según la extensión
      let contentType = 'audio/flac';
      const lowerFileName = decodedFileName.toLowerCase();
      if (lowerFileName.endsWith('.mp3')) contentType = 'audio/mpeg';
      else if (lowerFileName.endsWith('.jpg') || lowerFileName.endsWith('.jpeg')) contentType = 'image/jpeg';
      else if (lowerFileName.endsWith('.png')) contentType = 'image/png';

      const stats = await fileService.getFileStats(filePath);
      const fileSize = stats.size;

      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        console.log(`[FileRoutes] Range request: ${rangeHeader}`);
        const rangeMatch = rangeHeader.match(/bytes=(\\d+)?-(\\d+)?/);
        if (rangeMatch) {
          let start = parseInt(rangeMatch[1], 10) || 0;
          let end = parseInt(rangeMatch[2], 10) || fileSize - 1;
          if (start >= fileSize || end >= fileSize) {
            return res.status(416).set('Content-Range', `bytes */${fileSize}`).send('Range Not Satisfiable');
          }
          if (start > end) {
            start = 0;
            end = fileSize - 1;
          }
          const contentLength = end - start + 1;
          res.status(206).set({
            'Content-Type': contentType,
            'Content-Length': contentLength,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
          });
          console.log(`[FileRoutes] Sending 206 Partial Content: ${start}-${end}/${fileSize} (${(contentLength / 1024 / 1024).toFixed(2)}MB)`);
          const stream = fileService.createFileStream(fullPath, start, end);
          stream.pipe(res);
          return;
        }
      }

      // Sin Range Request o rango inválido → enviar todo el archivo
      res.set({
        'Content-Type': contentType,
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      });
      console.log(`[FileRoutes] Sending full content: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
      const stream = fileService.createFileStream(fullPath, 0, fileSize - 1);
      stream.pipe(res);
    } catch (error) {
      console.error('Error streaming file:', error);
      res.status(404).json({ success: false, error: 'File not found' });
    }
  });

  // ---------------------------------------------------
  // Mover archivo
  // ---------------------------------------------------
  router.post('/move', async (req, res) => {
    try {
      const { fileName, fromFolder, toFolder } = req.body;
      if (!fileName) {
        return res.status(400).json({ success: false, error: 'File name is required' });
      }
      await fileService.moveFile(fileName, fromFolder || '', toFolder || '');
      res.json({ success: true, message: 'File moved successfully' });
    } catch (error) {
      console.error('Error moving file:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // ---------------------------------------------------
  // Descargar archivo individual
  // ---------------------------------------------------
  router.get('/download', async (req, res) => {
    try {
      const fileName = req.query.file || '';
      const folder = req.query.folder || '';
      if (!fileName) {
        return res.status(400).json({ success: false, error: 'El parámetro file es requerido' });
      }
      const decodedFileName = decodeURIComponent(fileName);
      const filePath = folder ? `${folder}/${decodedFileName}` : decodedFileName;
      const fullPath = await fileService.getFileStream(filePath);
      res.download(fullPath, decodedFileName, (err) => {
        if (err && !res.headersSent) {
          console.error('[FileRoutes] Error en descarga individual:', err);
          res.status(500).json({ success: false, error: 'Error al descargar archivo' });
        }
      });
    } catch (error) {
      console.error('[FileRoutes] Error descargando archivo:', error);
      res.status(404).json({ success: false, error: 'Archivo no encontrado' });
    }
  });

  // ---------------------------------------------------
  // Descargar carpeta completa en ZIP (streaming)
  // ---------------------------------------------------
  router.get('/download-folder', async (req, res) => {
    try {
      const folder = req.query.folder || '';
      const normalizedFolder = folder ? folder.replace(/\\//g, path.sep) : '';
      const folderFullPath = path.join(fileService.uploadDir, normalizedFolder);
      if (!fs.existsSync(folderFullPath)) {
        return res.status(404).json({ success: false, error: 'Carpeta no encontrada' });
      }
      const folderName = folder ? path.basename(folder) : 'Biblioteca_Musical';
      const safeZipName = `${folderName.replace(/[^\\w\\s.-]/gi, '_')}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeZipName)}"`);

      const archive = archiver('zip', { zlib: { level: 0 } });
      archive.on('error', (err) => {
        console.error('[FileRoutes] Error en compresión ZIP:', err);
        if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
      });
      archive.pipe(res);
      archive.directory(folderFullPath, false);
      await archive.finalize();
      console.log(`[FileRoutes] Carpeta descargada exitosamente en ZIP: ${folder}`);
    } catch (error) {
      console.error('[FileRoutes] Error descargando carpeta en ZIP:', error);
      if (!res.headersSent) res.status(500).json({ success: false, error: error.message });
    }
  });

  // ---------------------------------------------------
  // Eliminar archivo
  // ---------------------------------------------------
  router.delete('/:fileName', async (req, res) => {
    try {
      const { fileName } = req.params;
      const folder = req.query.folder || '';
      const decodedFileName = decodeURIComponent(fileName);
      const filePath = folder ? `${folder}/${decodedFileName}` : decodedFileName;
      await fileService.deleteFile(filePath);
      res.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  return router;
}

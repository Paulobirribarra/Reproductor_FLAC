import express from 'express';

export function createFileRoutes(fileService, upload) {
  const router = express.Router();

  // Listar archivos y carpetas
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

  // Subir archivo
  router.post('/upload', (req, res, next) => {
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
      console.log('Upload request received');
      if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const folder = req.query.folder || '';
      console.log('[FileRoutes] Saving file to folder:', folder);
      const fileInfo = await fileService.saveFile(req.file, folder);

      console.log('File uploaded:', fileInfo);
      res.status(201).json({
        success: true,
        data: fileInfo,
      });
    } catch (error) {
      console.error('Error in upload:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Crear carpeta
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

  // Renombrar archivo
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

  // Descargar/reproducir archivo con Range Requests (RFC 7233)
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
      if (lowerFileName.endsWith('.mp3')) {
        contentType = 'audio/mpeg';
      }

      // Obtener información del archivo para Range Requests
      const stats = await fileService.getFileStats(filePath);
      const fileSize = stats.size;

      // Procesar Range Request (RFC 7233)
      const rangeHeader = req.headers.range;

      if (rangeHeader) {
        console.log(`[FileRoutes] Range request: ${rangeHeader}`);
        const rangeMatch = rangeHeader.match(/bytes=(\d+)?-(\d+)?/);

        if (rangeMatch) {
          let start = parseInt(rangeMatch[1], 10) || 0;
          let end = parseInt(rangeMatch[2], 10) || fileSize - 1;

          // Validar rango
          if (start >= fileSize || end >= fileSize) {
            return res.status(416)
              .set('Content-Range', `bytes */${fileSize}`)
              .send('Range Not Satisfiable');
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

          // Usar createReadStream con opciones de rango
          const stream = fileService.createFileStream(fullPath, start, end);
          stream.pipe(res);
          return;
        }
      }

      // Sin Range Request o Range inválido: enviar todo el archivo
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

  // Eliminar carpeta (debe ir ANTES de eliminar archivo para evitar conflictos de rutas)
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

  // Mover archivo
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

  // Eliminar archivo
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

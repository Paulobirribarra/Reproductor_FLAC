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
        return res.status(400).json({ success: false, error: 'Folder name is required' });
      }

      const result = await fileService.createFolder(folderName, parentFolder || '');
      res.status(201).json(result);
    } catch (error) {
      console.error('Error creating folder:', error);
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
        return res.status(400).json({ success: false, error: 'New name is required' });
      }

      const filePath = currentFolder ? `${currentFolder}/${decodedFileName}` : decodedFileName;
      const result = await fileService.renameFile(filePath, newName);

      res.json(result);
    } catch (error) {
      console.error('Error renaming file:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Descargar/reproducir archivo
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

      // Usar sendFile con Range support para mejor streaming de audio
      // Determinar Content-Type según la extensión
      let contentType = 'audio/flac';
      const lowerFileName = decodedFileName.toLowerCase();
      if (lowerFileName.endsWith('.mp3')) {
        contentType = 'audio/mpeg';
      }
      
      res.sendFile(fullPath, {
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600'
        }
      });
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

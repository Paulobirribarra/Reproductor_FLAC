import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { FileService } from './services/fileService.js';
import { createFileRoutes } from './routes/fileRoutes.js';
import { createPreloadRoutes } from './routes/preloadRoutes.js';
import { getRedisService } from './services/redisService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../uploads');

// Configuración
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Servicios
const fileService = new FileService(uploadDir);

// Inicializar Redis
const redisService = getRedisService();
await redisService.connect().catch((err) => {
  console.warn('⚠️  Redis no disponible, caché de preload deshabilitado:', err.message);
});

// Configurar multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.query.folder || req.body.folder || '';
    console.log('[Multer] Destination - folder from query:', req.query.folder);
    console.log('[Multer] Destination - folder from body:', req.body.folder);
    console.log('[Multer] Final folder:', folder);
    // Normalizar ruta: convertir / a separador del SO
    const normalizedFolder = folder.replace(/\//g, path.sep);
    const destPath = normalizedFolder ? path.join(uploadDir, normalizedFolder) : uploadDir;
    console.log('[Multer] Destination path:', destPath);
    fileService.ensureDir(destPath).then(() => cb(null, destPath)).catch(cb);
  },
  filename: (req, file, cb) => {
    // Preservar el nombre original del archivo
    cb(null, file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['audio/flac', 'audio/x-flac', 'audio/mpeg', 'audio/mp3'];
  const allowedExtensions = ['.flac', '.mp3'];
  
  // Obtener extensión del archivo
  const fileName = file.originalname.toLowerCase();
  const ext = fileName.substring(fileName.lastIndexOf('.'));
  
  // Validar por MIME type o extensión
  const isMimeValid = allowedTypes.includes(file.mimetype);
  const isExtValid = allowedExtensions.includes(ext);
  
  console.log(`[Upload] Archivo: ${file.originalname}, MIME: ${file.mimetype}, Ext: ${ext}`);
  
  if (isMimeValid || isExtValid) {
    cb(null, true);
  } else {
    cb(new Error(`Solo se permiten archivos FLAC y MP3 (recibido: ${file.mimetype})`));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
  fileFilter,
});

// Crear app
const app = express();

// Middleware
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Middleware para procesar binarios en /api/preload/cache/binary
app.use('/api/preload/cache/binary', express.raw({ type: 'application/octet-stream', limit: '500mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Rutas de archivos
app.use('/api/files', createFileRoutes(fileService, upload));

// Rutas de preload (caché Redis)
app.use('/api/preload', createPreloadRoutes());

// Error handler
app.use((err, req, res, next) => {
  console.error('Error caught:', err.message);
  console.error('Error stack:', err.stack);
  res.status(err.status || 500).json({ success: false, error: err.message || 'Internal server error' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`Upload directory: ${uploadDir}`);
});

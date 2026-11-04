import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { FileService } from './services/fileService.js';
import { createMetadataService } from './services/metadataService.js';
import { createFileRoutes } from './routes/fileRoutes.js';
import { createMetadataRoutes } from './routes/metadataRoutes.js';
import { createPreloadRoutes } from './routes/preloadRoutes.js';
import { createLastFmRoutes } from './routes/lastfmRoutes.js';
import { createPlaylistRoutes } from './routes/playlistRoutes.js';
import { createCoverRoutes } from './routes/coverRoutes.js';
import { getRedisService } from './services/redisService.js';
import { LastFmService } from './services/lastfmService.js';
import { PlaylistService } from './services/playlistService.js';
import { getCoverService } from './services/coverService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Directorio de uploads
// Ruta que define donde debe subir y escanear archivos de audio 
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

// Configuración
const PORT = process.env.PORT || 5000;

// Lista dinámica de orígenes permitidos para CORS
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://100.99.181.34:5173',
  'http://100.99.181.34:5174',
  'http://raspi.flicker-mirach.ts.net:5173',
  'http://raspi.flicker-mirach.ts.net:5174',
  'https://raspi.flicker-mirach.ts.net',
  'https://raspi.flicker-mirach.ts.net:5173',
  'https://raspi.flicker-mirach.ts.net:5174',
];

// Si tienes un CORS_ORIGIN específico en el .env, lo añadimos también a la lista
if (process.env.CORS_ORIGIN && !ALLOWED_ORIGINS.includes(process.env.CORS_ORIGIN)) {
  ALLOWED_ORIGINS.push(process.env.CORS_ORIGIN);
}

// Inicializar Redis
const redisService = getRedisService();
await redisService.connect().catch((err) => {
  console.warn('⚠️  Redis no disponible, caché de preload deshabilitado:', err.message);
});

// Servicios
const fileService = new FileService(uploadDir);
const metadataService = createMetadataService(uploadDir);
const lastFmService = new LastFmService(redisService);
const playlistService = new PlaylistService(path.join(__dirname, '../data'));
const coverService = getCoverService(uploadDir);

// Configurar multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.query.folder || req.body.folder || '';
    console.log('[Multer] Destination - folder from query:', req.query.folder);
    console.log('[Multer] Destination - folder from body:', req.body.folder);
    console.log('[Final folder:', folder);
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
  const allowedTypes = [
    'audio/flac', 'audio/x-flac', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'application/x-cue', 'text/plain'
  ];
  const allowedExtensions = ['.flac', '.mp3', '.wav', '.jpg', '.jpeg', '.png', '.webp', '.cue'];

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
    cb(new Error(`Tipo de archivo no permitido (recibido: ${file.mimetype}, extensión: ${ext})`));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
  fileFilter,
});

// Crear app
const app = express();

// Middleware de CORS dinámico basado en la lista blanca
app.use(cors({
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (como tags nativos de audio, Postman, curl, etc.)
    // o cualquier origen que esté en nuestra lista
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] 🛑 Petición bloqueada desde un origen no permitido: ${origin}`);
      callback(new Error('Bloqueado por la política de CORS del Reproductor'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Servir archivos estáticos desde la carpeta uploads con caché HTTP eficiente para carátulas
app.use('/uploads', express.static(uploadDir, {
  maxAge: '7d',
  immutable: true,
  etag: true,
  lastModified: true
}));

// Middleware para procesar binarios en /api/preload/cache/binary
app.use('/api/preload/cache/binary', express.raw({ type: 'application/octet-stream', limit: '500mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Rutas de archivos
app.use('/api/files', createFileRoutes(fileService, upload));

// Rutas de metadatos
app.use('/api/metadata', createMetadataRoutes(metadataService, redisService));

// Rutas de preload (caché Redis)
app.use('/api/preload', createPreloadRoutes());

// Rutas de Last.fm
app.use('/api/lastfm', createLastFmRoutes(lastFmService));

// Rutas de Playlists
app.use('/api/playlists', createPlaylistRoutes(playlistService));

// Rutas de Carátulas optimizadas (WebP 150x150 en DB 2)
app.use('/api/covers', createCoverRoutes(coverService));

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
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  // Disable request timeout to prevent 408 errors on large streaming files
  server.timeout = 0; // No timeout on request processing
  console.log(`📂 Upload directory: ${uploadDir}`);
  console.log(`🔒 Allowed CORS Origins: ${ALLOWED_ORIGINS.join(', ')}`);
});

// Aumentar timeouts de keep-alive para evitar desconexiones por timeout o ping fallido en proxies/Tailscale
server.keepAliveTimeout = 120000; // 120 segundos
server.headersTimeout = 125000;   // 125 segundos
server.requestTimeout = 0;        // Desactiva el request timeout de Node.js HTTP (evita 408 Request Timeout en streaming)
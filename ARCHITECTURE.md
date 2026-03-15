# Reproductor FLAC Web - Arquitectura y Guía de Desarrollo

## 📋 Descripción del Proyecto

Aplicación web para subir, almacenar y reproducir archivos FLAC de forma segura y escalable. Diseñada con arquitectura modular para facilitar futuras expansiones.

---

## 🛠️ Stack Tecnológico

### **Frontend**
- **React 18+** - Framework UI moderno
- **TypeScript** - Tipado estático para mayor seguridad
- **Tailwind CSS** - Framework CSS utility-first
- **Vite** - Build tool ultrarápido
- **zustand** - Gestión de estado ligera y escalable
- **Web Workers** - Reproducción persistente e independiente
- **libflac.js** - Decodificador FLAC (WebAssembly)
- **react-dropzone** - Carga de archivos con drag-drop
- **axios** - Cliente HTTP
- **SweetAlert2** - Confirmaciones y notificaciones
- **date-fns** - Manipulación de fechas

### **Backend (Node.js + Express)**
- **Node.js 20+ LTS** - Runtime JavaScript
- **Express.js** - Framework web minimalista
- **TypeScript** - Mismo lenguaje frontend/backend
- **multer** - Middleware para carga de archivos
- **ioredis** - Cliente Redis para caché distribuido con BD + Prefix namespacing
- **UUID** - Generación de IDs únicos
- **dotenv** - Variables de entorno
- **cors** - Control de origen cruzado

### **Almacenamiento**
- **Sistema de archivos local** (escalable a S3/MinIO después)
- Estructura: `/uploads/users/{userId}/flac/{fileId}`
- **Redis** - Caché distribuido para precarga de archivos (Opcional, failsafe)

### **DevOps**
- **Docker** - Containerización
- **Docker Compose** - Orquestación local
- **Dockerfile** multi-stage - Optimización para ARM64v8

---

## 📁 Estructura del Proyecto

```
reproductor-flac/
├── frontend/                    # Aplicación React
│   ├── src/
│   │   ├── components/
│   │   │   ├── Player/
│   │   │   │   ├── Player.tsx
│   │   │   │   └── NextUp.tsx
│   │   │   ├── FileUpload/
│   │   │   │   └── FileUpload.tsx
│   │   │   ├── FileList/
│   │   │   │   └── FileList.tsx
│   │   │   ├── FolderBrowser/
│   │   │   │   └── FolderBrowser.tsx
│   │   │   └── CreateFolder/
│   │   │       └── CreateFolder.tsx
│   │   ├── workers/
│   │   │   ├── audioWorker.ts       # Worker para reproducción persistente
│   │   │   └── filePreloadWorker.ts # Worker para precarga en background
│   │   ├── hooks/
│   │   │   ├── useAudioWorker.ts    # Hook para controlar audioWorker
│   │   │   ├── usePreloader.ts
│   │   │   └── useFileWorker.ts     # Hook para precarga
│   │   ├── services/
│   │   │   └── api.ts              # Cliente HTTP
│   │   ├── store/
│   │   │   ├── playerStore.ts      # Estado del reproductor (UI)
│   │   │   ├── filesStore.ts       # Estado de carpetas/archivos
│   │   │   └── workerStore.ts      # Sincronización con Workers
│   │   ├── types/
│   │   │   └── index.ts            # Interfaces centralizadas
│   │   ├── App.tsx
│   │   └── index.css
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── Dockerfile
├── backend/                     # Servidor Express
│   ├── src/
│   │   ├── routes/
│   │   │   └── fileRoutes.js
│   │   ├── services/
│   │   │   └── fileService.js
│   │   ├── index.js
│   │   └── .env
│   ├── uploads/
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── .gitignore
├── README.md
└── NOTES.md
```

---

## 🎯 Arquitectura de Web Workers

### **¿Por qué Workers?**

**Problema sin Workers:**
- Si navegas a otra carpeta → componente se remonta → audio se corta
- Si cierras pestaña → pierde la sesión
- Si la app falla → pierde reproducción

**Solución con Workers:**
- ✅ Reproducción independiente del ciclo React
- ✅ Sesión persiste aunque recargues la página
- ✅ Puedes navegar libremente sin interrumpir música
- ✅ Precarga en background sin bloquear UI
- ✅ Escalable para múltiples workers simultáneos

### **Flujo de Arquitectura**

```
┌─────────────────────────────────────────────────────┐
│         React Components (UI)                       │
│  - App.tsx (Navegación + Carpetas)                  │
│  - Player.tsx (Controles visuales)                  │
│  - FileList.tsx (Archivos)                          │
└──────────────────────┬──────────────────────────────┘
                       │ postMessage()
                       ↓
┌─────────────────────────────────────────────────────┐
│        Hooks (Interfaz)                             │
│  - useAudioWorker()                                 │
│  - useFileWorker()                                  │
│  - workerStore (Zustand)                            │
└──────────────────────┬──────────────────────────────┘
                       │ Communicate
        ┌──────────────┴──────────────┐
        ↓                             ↓
┌──────────────────────┐    ┌──────────────────────┐
│  audioWorker.ts      │    │filePreloadWorker     │
│   Persistente        │    │   Background         │
│  - Reproducción      │    │  - Precarga          │
│  - Estado            │    │  - Indexación        │
│  - Tiempo            │    │  - Metadatos         │
└──────────────┬───────┘    └──────────────┬───────┘
               │                           │
               └───────────────┬───────────┘
                               │ postMessage()
                               ↓
                  ┌──────────────────────────┐
                  │  Store (Zustand)         │
                  │  - Sincronización        │
                  │  - Estado global         │
                  └──────────────────────────┘
                               ↑
                               │ subscribe()
                               │
                  Componentes React
```

### **audioWorker.ts - Reproducción Persistente**

```typescript
// Responsabilidades:
// 1. Mantener sesión de reproducción
// 2. Controlar el elemento <audio>
// 3. Actualizar tiempo de reproducción
// 4. Manejar eventos de fin de archivo
// 5. Independiente del ciclo React

interface AudioSession {
  currentFile: FileInfo & { fullPath: string };
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playlist: FileInfo[];
  playlistIndex: number;
  volume: number;
  paused: boolean;
}

// El worker escucha comandos:
// PLAY, PAUSE, SEEK, NEXT, PREV, SET_VOLUME
// Y emite: STATE_UPDATE, PLAYBACK_ENDED
```

### **filePreloadWorker.ts - Precarga en Background**

```typescript
// Responsabilidades:
// 1. Precargar siguiente archivo desde servidor
// 2. Almacenar en caché Redis distribuido
// 3. Fallback a memoria si Redis no está disponible
// 4. No bloquea UI

// Comunica con:
// API Backend: /api/preload/cache
// Emit messages:
// PRELOAD_PROGRESS, PRELOAD_READY, PRELOAD_ERROR, CACHE_CLEARED

// Storage Strategy:
// 1. Verifica si existe en Redis
// 2. Si NO existe, descarga desde /api/files/stream
// 3. Envía a Redis via POST /api/preload/cache
// 4. Si Redis falla, continúa sin persistencia
```

### **workerStore.ts - Sincronización Global**

```typescript
// Zustand store que sincroniza estado de workers
export const useWorkerStore = create((set) => ({
  // Audio session del worker
  audioSession: null,
  setAudioSession: (session) => set({ audioSession: session }),
  
  // Preload progress
  preloadProgress: 0,
  setPreloadProgress: (progress) => set({ preloadProgress: progress }),
  
  // Referencias a workers
  audioWorker: null,
  fileWorker: null,
  
  // Métodos para comunicarse con workers
  play: (file, fullPath) => { /* send message */ },
  pause: () => { /* send message */ },
  seek: (time) => { /* send message */ }
}));
```

---

## �️ Caché Distribuido con Redis

### **¿Por qué Redis?**

**Problema sin caché distribuido:**
- Archivos pesados (60 min FLAC ≈ 164+ MB) se descargan cada vez
- No hay persistencia entre sesiones
- Ancho de banda malgastado
- Múltiples tabs/navegadores sin sincronización

**Solución con Redis:**
- ✅ Persistencia entre sesiones (24h TTL configurable)
- ✅ Comparte caché entre múltiples tabs/navegadores
- ✅ Capacidad ilimitada (configurable, hasta GBs)
- ✅ Precarga instantánea del siguiente archivo
- ✅ Streaming binario para archivos grandes (>50MB)
- ✅ Failsafe: funciona sin Redis (sin persistencia)

### **Estrategia de Almacenamiento por Tamaño**

| Tamaño | Método | Ventaja |
|--------|--------|---------|
| **<50 MB** | JSON + Base64 | Simplicidad, bajo overhead |
| **≥50 MB** | Streaming Binario | Sin amplificación (164 MB = 164 MB) |

**Flujo automático:**
```
filePreloadWorker descarga archivo
    ↓
¿Tamaño > 50MB?
    ├─ SI  → POST /api/preload/cache/binary (streaming binario)
    └─ NO  → POST /api/preload/cache (JSON base64)
    ↓
Archivo guardado en Redis (BD 0, prefijo: audio:)
    ↓
Siguiente: Acceso instantáneo ⚡
```

### **Flujo de Precarga con Redis**

```
┌──────────────────────────────────────┐
│  User reproduce archivo A (164 MB)   │
└────────────┬─────────────────────────┘
             ↓
┌──────────────────────────────────────┐
│  audioWorker.preloadNextFile()       │
│  Envía comando a filePreloadWorker   │
└────────────┬─────────────────────────┘
             ↓
┌──────────────────────────────────────────────────────────┐
│  filePreloadWorker descarga B desde backend              │
│  GET /api/files/stream (archivo B)                       │
└────────────┬─────────────────────────────────────────────┘
             ↓
┌──────────────────────────────────────────────────────────┐
│  ¿Tamaño de B > 50MB?                                    │
│  164 MB > 50 MB → SÍ                                     │
└────────────┬─────────────────────────────────────────────┘
             ↓
┌──────────────────────────────────────────────────────────┐
│  POST /api/preload/cache/binary?cacheKey=...             │
│  (Sin base64, streaming binario directo = 164 MB)        │
│  Content-Type: application/octet-stream                  │
└────────────┬─────────────────────────────────────────────┘
             ↓
      ✅ B ready en Redis (164 MB exactos)
    User cambia a B → Instantáneo! ⚡
```

### **Configuración**

**Variables de entorno (.env):**
```env
# Redis
REDIS_URL=redis://localhost:6379        # URL de conexión (Docker: redis://redis:6379)
REDIS_MAX_CACHE_SIZE=1073741824         # 1 GB máximo
REDIS_CACHE_TTL=86400                   # 24 horas TTL
```

**Con Docker Compose:**
```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
```

### **Estadísticas y Monitoreo**

Endpoint: `GET /api/preload/stats`
```json
{
  "connected": true,
  "itemCount": 5,
  "sizeBytes": 1073741824,
  "sizeMB": "1024.00",
  "maxSizeMB": "1024.00",
  "ttlSeconds": 86400
}
```

---

## 📦 Soporte para Archivos Grandes (164+ MB)

### **Problema: Base64 Amplifica Tamaño**

Base64 aumenta el tamaño un **33%**:
- 164 MB archivo original
- 164 MB × 1.33 = **218 MB en JSON** ❌

Solución: **Streaming Binario** para archivos >50MB

### **Implementación**

**Detección automática en filePreloadWorker:**

```typescript
const sizeMB = bufferSize / 1024 / 1024;

if (sizeMB > 50) {
  // Archivo grande: POST /api/preload/cache/binary
  // Content-Type: application/octet-stream
  // Body: buffer binario directo (SIN base64)
  // Resultado: 164 MB = 164 MB (sin overhead) ✅
} else {
  // Archivo pequeño: POST /api/preload/cache
  // Content-Type: application/json
  // Body: { cacheKey, buffer: base64String }
  // Útil para archivos simples
}
```

**Backend soporta ambos:**

```javascript
// Archivos pequeños
POST /api/preload/cache
Content-Type: application/json

// Archivos grandes
POST /api/preload/cache/binary?cacheKey=...
Content-Type: application/octet-stream
```

### **Límites Configurables**

En `backend/.env`:
```env
# Express permite hasta 500MB en binarios
REDIS_MAX_CACHE_SIZE=1073741824  # 1 GB en Redis
```

---

### **Estrategia: BD + Prefix (Máxima Seguridad)**

Para evitar colisiones cuando múltiples apps comparten el mismo servidor Redis:

**Componentes:**
1. **BD Redis** (0-15) - Cada app usa su propia BD
2. **Prefijo de clave** - Dentro de la BD, adicional seguridad

**Configuración por App:**

```env
# Reproductor FLAC
APP_NAME=reproductor-flac
REDIS_URL=redis://localhost:6379/0    # BD 0
REDIS_KEY_PREFIX=audio:                 # Prefijo

# Resultado de clave: redis://localhost:6379/0 > audio:preload:archivo.flac
```

```env
# App Imágenes (otro proyecto)
APP_NAME=galeria-imagenes
REDIS_URL=redis://localhost:6379/1    # BD 1
REDIS_KEY_PREFIX=images:                # Prefijo

# Resultado de clave: redis://localhost:6379/1 > images:cache:foto.jpg
```

```env
# App Videos (otro proyecto)
APP_NAME=videos-manager
REDIS_URL=redis://localhost:6379/2    # BD 2
REDIS_KEY_PREFIX=videos:                # Prefijo

# Resultado de clave: redis://localhost:6379/2 > videos:cache:video.mp4
```

**Monitoreo de todas las apps en un Redis:**

```bash
# Ver claves de Reproductor FLAC (BD 0)
docker exec redis-cache redis-cli -n 0 KEYS audio:*

# Ver claves de Imágenes (BD 1)
docker exec redis-cache redis-cli -n 1 KEYS images:*

# Ver estadísticas de todas las BDs
docker exec redis-cache redis-cli INFO keyspace
# Output:
# db0:keys=10,expires=10,avg_ttl=86000
# db1:keys=50,expires=50,avg_ttl=72000
# db2:keys=5,expires=5,avg_ttl=86000

# Limpiar SOLO caché de Reproductor (BD 0)
docker exec redis-cache redis-cli -n 0 FLUSHDB

# Limpiar SOLO caché de Imágenes (BD 1)
docker exec redis-cache redis-cli -n 1 FLUSHDB
```

---

### **Requisitos Previos**
- Node.js 20+ LTS
- npm o yarn
- Docker (opcional)
- Git

### **1. Clonar y Instalar**

```bash
# Clonar repositorio
git clone <repo-url>
cd reproductor-flac

# Instalar dependencias frontend
cd frontend
npm install

# Instalar dependencias backend
cd ../backend
npm install
cd ..
```

### **2. Variables de Entorno**

**backend/.env.local:**
```env
# Server
NODE_ENV=development
PORT=5000

# Almacenamiento
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=104857600  # 100MB en bytes
ALLOWED_MIME_TYPES=audio/flac,audio/x-flac

# CORS
CORS_ORIGIN=http://localhost:5173

# JWT (para versiones futuras con autenticación)
JWT_SECRET=your-secret-key-here

# App Identifier (para multi-app)
APP_NAME=reproductor-flac

# Redis Cache (con BD + Prefix namespacing)
REDIS_URL=redis://localhost:6379/0      # /0 = BD 0 (cambia por app)
REDIS_KEY_PREFIX=audio:                 # Prefijo único por app
REDIS_MAX_CACHE_SIZE=1073741824         # 1 GB
REDIS_CACHE_TTL=86400                   # 24 horas
```

**frontend/.env.local:**
```env
VITE_API_URL=http://localhost:5000
```

---

## 🎯 Rutas API

### **Upload de Archivos**
```
POST /api/files/upload
Content-Type: multipart/form-data

Request:
{
  "file": <binary>
}

Response: 
{
  "id": "uuid",
  "name": "cancion.flac",
  "size": 10485760,
  "duration": 180,
  "uploadedAt": "2025-12-26T10:30:00Z"
}
```

### **Listar Archivos**
```
GET /api/files

Response:
{
  "files": [
    {
      "id": "uuid",
      "name": "cancion.flac",
      "size": 10485760,
      "duration": 180,
      "uploadedAt": "2025-12-26T10:30:00Z"
    }
  ]
}
```

### **Descargar/Reproducir**
```
GET /api/files/:fileId/stream

Response: Binary audio stream (FLAC)
```

### **Caché Redis (Precarga)**
```
GET /api/preload/cache/:cacheKey
Obtener archivo del caché

POST /api/preload/cache
Body: { cacheKey, buffer }
Guardar archivo pequeño (<50MB) en caché (JSON base64)

POST /api/preload/cache/binary
Query: ?cacheKey=archivo.flac
Content-Type: application/octet-stream
Guardar archivo grande (>50MB) en caché (streaming binario)

DELETE /api/preload/cache/:cacheKey
Eliminar archivo específico del caché

DELETE /api/preload/cache
Limpiar todo el caché

GET /api/preload/cache/:cacheKey/exists
Verificar si existe en caché

GET /api/preload/stats
Obtener estadísticas del caché Redis
Response: { itemCount, sizeBytes, sizeMB, maxSizeMB, ttlSeconds, connected }
```

### **Eliminar Archivo**
```
DELETE /api/files/:fileId

Response:
{
  "success": true,
  "message": "Archivo eliminado"
}
```

---

## 📦 Dependencias Principales

### **Frontend (package.json)**
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "zustand": "^4.4.0",
    "axios": "^1.6.0",
    "date-fns": "^2.30.0",
    "react-dropzone": "^14.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "vite": "^5.0.0"
  }
}
```

### **Backend (package.json)**
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "multer": "^1.4.0",
    "cors": "^2.8.0",
    "uuid": "^9.0.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/multer": "^1.4.0",
    "typescript": "^5.3.0",
    "ts-node": "^10.9.0",
    "nodemon": "^3.0.0"
  }
}
```

---

## 🚀 Desarrollo Local

### **Terminal 1 - Backend**
```bash
cd backend
npm run dev
# Escucha en http://localhost:5000
# Logs: Ver console para requests de streaming
```

### **Terminal 2 - Frontend**
```bash
cd frontend
npm run dev
# Escucha en http://localhost:5173
# Hot reload activado
# Workers se cargan automáticamente
```

### **Verificar que Workers Funcionan**

1. Abre DevTools (F12) → Console
2. Sube un archivo FLAC
3. Reproduce el archivo
4. En la consola deberías ver:
   ```
   [audioWorker] Iniciado
   [audioWorker] Comando recibido: PLAY
   [audioWorker] Estado actualizado: isPlaying = true
   ```
5. Navega a otra carpeta
6. **La música NO debe pausarse** ✅
7. En DevTools → Sources → verifica que hay un worker thread activo

### **Testing con Workers**

```bash
# Frontend
cd frontend

# Ver todos los workers activos
open DevTools → Sources → Threads

# Probar flujo completo:
# 1. Reproducir archivo
# 2. Cambiar de carpeta (Sin parar la música)
# 3. Crear carpeta nueva
# 4. Cargar más archivos
# 5. Música debe continuar ✅
```

### **Testing con Redis**

```bash
# 1. Asegurarse que Redis está corriendo
docker ps | grep redis
# O si está local en localhost:6379

# 2. En DevTools → Console
# Ejecutar precarga manual
# Cambiar de archivo rápidamente
# El siguiente archivo debería estar listo (precargado)

# 3. Ver estadísticas de caché
# GET http://localhost:5000/api/preload/stats
# Response: { itemCount, sizeBytes, connected }

# 4. Limpiar caché SI ES NECESARIO
# DELETE http://localhost:5000/api/preload/cache
```

### **Monitoreo de Redis CLI (Namespacing)**

```bash
# Conectar a Redis
redis-cli

# BD 0 (Reproductor FLAC)
> SELECT 0
OK
> KEYS audio:*
(array) 
  1) "audio:preload:archivo1.flac"
  2) "audio:preload:archivo2.flac"

# Ver tamaño de una clave
> STRLEN audio:preload:archivo1.flac
(integer) 104857600

# Ver TTL
> TTL audio:preload:archivo1.flac
(integer) 86394

# Si tuvieras otra app en BD 1:
> SELECT 1
OK
> KEYS images:*
(array)
  1) "images:cache:foto.jpg"

# Ver estadísticas de todas las BDs
> INFO keyspace
# db0:keys=2,expires=2,avg_ttl=86000
# db1:keys=15,expires=15,avg_ttl=72000

# Limpiar SOLO BD 0 (sin afectar BD 1)
> SELECT 0
OK
> FLUSHDB
OK

# Salir
> EXIT
```

---

## 🐳 Docker (Para Fase 3)

⏸️ **Por ahora:** Enfocados en Workers y testing
✅ **Después:** Configurar Docker Compose con persistencia

---

## 🔍 Debugging de Workers

### **DevTools - Sources**
1. F12 → Sources → Threads
2. Verás:
   - Main thread (React)
   - audioWorker thread
   - filePreloadWorker thread
3. Puedes poner breakpoints en workers

### **Console Logging**
```typescript
// En audioWorker.ts
self.postMessage({ 
  type: 'DEBUG_LOG', 
  message: 'Reproducción iniciada' 
});
```

### **Errores Comunes**

| Error | Causa | Solución |
|-------|-------|----------|
| `Uncaught SyntaxError in Worker` | Worker mal compilado | Verificar `vite.config.ts` |
| `Failed to construct Worker` | Path incorrecto | Usar `new URL()` en import |
| `postMessage undefined` | Worker no inicializado | Esperar a que worker cargue |
| `Audio sigue reproduciendo pero no se ve progreso` | workerStore no sincroniza | Verificar subscribe() en hooks |
| `⚠️  Redis no disponible` | Redis no está corriendo | Iniciar Redis en Docker o localhost:6379 |
| `Error guardando en Redis` | Conexión fallida a Redis | Verificar REDIS_URL en .env |
| `Cache size limit exceeded` | Caché lleno | Aumentar REDIS_MAX_CACHE_SIZE o limpiar caché |
| `request entity too large (binario)` | Archivo >500MB | Aumentar límite en `express.raw()`: `limit: '1gb'` |
| `Precarga lenta en archivo 164MB` | Red lenta o Redis saturado | Normal (~30-60s depende conexión). Precarga ocurre en background |

---

## 📚 Recursos Útiles

- [Web Workers MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [Vite Worker Support](https://vitejs.dev/guide/features.html#web-workers)
- [Zustand Docs](https://github.com/pmndrs/zustand)
- [FLAC.js Docs](https://github.com/jremoting/flac.js)

---

## 🎬 Próximos Pasos

### **Esta Semana** ✅ COMPLETADOS
1. ✅ Implementar audioWorker.ts
2. ✅ Implementar filePreloadWorker.ts
3. ✅ Crear useAudioWorker hook
4. ✅ Crear workerStore
5. ✅ Integrar Workers en App.tsx
6. ✅ Testing manual completo
7. ✅ Documentar resultados
8. ✅ Implementar caché Redis para archivos pesados

### **Próximas Fases**
1. Persistencia con localStorage (UI state)
2. Testing automatizado (Jest + React Testing Library)
3. Docker Compose (Redis + Backend + Frontend)
4. Deployment a Production
5. Upgrade a Spring Boot 3 (futuro)
6. Migración a Azure Cloud (futuro)

---


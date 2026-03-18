# Reproductor FLAC Web - Arquitectura y Guía de Desarrollo

> **Disclaimer Legal:** Este proyecto es una herramienta para entusiastas de audio que desean mantener control total sobre su biblioteca musical personal. Este software está diseñado para uso personal en ambientes auto-alojados (NAS, servidores domésticos, Raspberry Pi, WSL) y **no proporciona contenido multimedia**. El usuario es responsable de asegurar que posee los derechos legales para almacenar, reproducir y transmitir cualquier archivo de audio. Este proyecto **no facilita, promueve ni respalda piratería o infracción de derechos de autor**. Al usar este software, aceptas cumplir con todas las leyes de derechos de autor aplicables en tu jurisdicción.

---

## Descripción del Proyecto

Streaming personal de música en alta calidad. Plataforma web autónoma para usuarios que desean alojar y reproducir su propia colección de audio FLAC en servidores personales, manteniendo control total sobre su música sin depender de servicios de pago centralizados.

Diseñado para propietarios de música que buscan:
- Control total sobre su contenido
- Reproducción en alta fidelidad (FLAC sin pérdidas)
- Privacidad y autonomía en almacenamiento
- Alternativa a servicios de streaming con políticas restrictivas

---

## Stack Tecnológico

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
- **Sistema de archivos local** con soporte para múltiples carpetas
- Estructura actual: `/uploads/{carpeta}/{archivo}`
- **Redis** - Caché distribuido para precarga instantánea (Opcional, failsafe)

### **DevOps**
- **Docker** - Containerización
- **Docker Compose** - Orquestación local

---

## Requisitos Previos

- **Node.js** 20+ LTS
- **Docker** y **Docker Compose**
- **Git**
- Navegador con soporte Web Workers y WebAssembly

---

## Quick Start

### Recomendado: Deployment con Docker

La forma recomendada para ejecutar esta aplicación es mediante Docker. Está optimizada para servidores locales (NAS, Raspberry Pi, WSL, servidor doméstico, etc.)

#### Requisitos Mínimos
- Docker y Docker Compose instalados
- 2GB RAM disponible
- Espacio de almacenamiento según tu biblioteca de música

#### Pasos Básicos

```bash
git clone <repository>
cd reproductor-flac

# Crear la red de Docker (si no existe)
docker network create app_network

# Construir e iniciar los contenedores
docker compose up -d --build

# Verificar que los servicios estén corriendo
docker compose ps

# Ver logs (opcional)
docker compose logs -f
```

**La aplicación estará disponible en:**
- Frontend: `http://localhost:5174`
- Backend API: `http://localhost:3000`

#### Comandos Útiles

```bash
# Detener contenedores
docker compose down

# Reiniciar servicios
docker compose restart

# Reconstruir después de cambios
docker compose up -d --build

# Ver logs específicos
docker compose logs reproductor-api
docker compose logs reproductor-web

# Acceso shell al contenedor
docker compose exec reproductor-api sh
docker compose exec reproductor-web sh

# Limpiar volúmenes (borra datos)
docker compose down -v
```

#### Soportado en

- Linux (servidor personal)
- Raspberry Pi (ARMv7/ARMv8)
- NAS (Synology, QNAP, etc.)
- WSL (Windows Subsystem for Linux)
- Docker Desktop (Windows/Mac)

---

### Alternativa: Desarrollo Local (Sin Docker)

Si prefieres ejecutar sin contenedores (para desarrollo):

```bash
git clone <repository>
cd reproductor-flac

# Instalar dependencias
cd backend && npm install
cd ../frontend && npm install
cd ..

# Terminal 1 - Iniciar Backend
cd backend
npm run dev

# Terminal 2 - Iniciar Frontend (en otra terminal)
cd frontend
npm run dev
```

La aplicación estará disponible en `http://localhost:5174`

---

## Variables de Entorno

### Backend (`.env`)
```
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5174

# Redis (opcional, failsafe si no está disponible)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
REDIS_PREFIX=audio:

# Almacenamiento
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=500000000
```

### Frontend (`.env.local`)
```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_HMR_HOST=localhost
VITE_HMR_PORT=5174
```

---

## Endpoints principales de API

| Método | Ruta | Descripción |
|--------|------|-------------|
| **POST** | `/api/files/upload` | Subir archivo FLAC |
| **GET** | `/api/files/list` | Listar archivos del usuario |
| **GET** | `/api/files/stream/:id` | Descargar archivo (streaming) |
| **DELETE** | `/api/files/:id` | Eliminar archivo |
| **POST** | `/api/preload/cache` | Guardar en caché (JSON+base64) |
| **POST** | `/api/preload/cache/binary` | Guardar en caché (streaming binario) |
| **GET** | `/api/preload/cache/:key` | Obtener del caché |

---

## Características Principales

- Reproducción de FLAC con decodificador WebAssembly (libflac.js)
- Web Workers para reproducción independiente y persistente
- Precarga inteligente del siguiente archivo en background
- Caché distribuido con Redis para acceso instantáneo
- Soporte para archivos grandes (>160 MB) con streaming binario
- Interfaz responsive con Tailwind CSS
- Gestión de estado centralizada con zustand
- Carga de archivos con drag-drop

---

## Caché Distribuido con Redis

### **¿Por qué Redis?**

**Problema sin caché distribuido:**
- Archivos pesados (60 min FLAC ≈ 164+ MB) se descargan cada vez
- No hay persistencia entre sesiones

**Solución con Redis:**
- Precarga instantánea del siguiente archivo
- Streaming binario para archivos grandes (>50MB)
- Failsafe: funciona sin Redis (sin persistencia)

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
Siguiente: Acceso instantáneo
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
      OK B ready en Redis (164 MB exactos)
    User cambia a B → Instantáneo! 
```

---
## Arquitectura de Flujos

### Flujo de Reproducción
1. Usuario selecciona archivo en lista
2. Frontend solicita stream al backend
3. Web Worker decodifica FLAC en tiempo real
4. Mientras se reproduce, filePreloadWorker descarga el siguiente
5. Si archivo es > 50MB, se almacena en Redis (binario)
6. Cambio instantáneo al siguiente archivo

### Flujo de Carga de Archivos
1. Usuario arrastra archivo o selecciona con input
2. multer valida formato (FLAC/MP3) y tamaño (hasta 1GB)
3. Archivo se almacena en estructura de carpetas personalizable
4. Backend responde con metadata (id, nombre, tamaño, duración)
5. Frontend actualiza lista con nueva música

---

## Notas de Desarrollo

- TypeScript configurado con `strict: true` para máxima seguridad de tipos
- Web Workers se comunican vía `postMessage` para reproducción independiente
- Redis usa prefijo namespacing `audio:` para evitar colisiones
- Failsafe automático: sin Redis, la app sigue funcionando (sin precarga persistente)
- Vite está configurado para proxy de `/api` hacia el backend

---

## Roadmap y Mejoras Futuras


- Lectura y extracción de metadatos (ID3v2, Vorbis Comments): género, carátula, álbum, artista, año
- Autenticación JWT (acceso seguro con usuario/password)
- Lista de favoritos (marcar/desmarcar canciones)
- Estadísticas básicas de reproducción (historial, canciones más escuchadas)
- Interfaz mejorada con búsqueda y filtrado por metadatos

---

## Licencia y Responsabilidad Legal

Este proyecto se distribuye bajo **MIT License with Personal Use Terms**. Esto significa:

**Permitido:**
- Usar la aplicación para gestionar tu propia música en servidores personales
- Modificar y adaptar el código para tus necesidades

**No permitido / Responsabilidad del Usuario:**
- Usar para reproducir, distribuir o alojar contenido protegido por derechos de autor sin autorización
- Facilitar piratería o infracción de derechos intelectuales
- Burlar sistemas de protección de derechos digitales (DRM)

**Importante:** 
Eres responsable de asegurar que tienes derecho legal a almacenar y reproducir cualquier contenido que subas. Consulta las leyes de tu jurisdicción respecto a derechos de autor y licencias de contenido.

Ver el archivo completo [LICENSE](LICENSE) para términos detallados.
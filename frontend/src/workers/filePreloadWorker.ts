/**
 * File Preload Worker
 * 
 * Precarga archivos de audio en background sin afectar la reproducción actual.
 * Utiliza API Backend + Redis para caché distribuido de archivos pesados.
 */

interface PreloadSession {
  fileName: string;
  filePath: string;
  streamUrl: string;
  status: 'pending' | 'loading' | 'ready' | 'error';
  error?: string;
  abortController?: AbortController;
  progress?: number;
}

interface FileInfoPayload {
  name: string;
  path: string;
}

// Configuración
const PRELOAD_API_BASE = '/api/preload';
const UPLOAD_API_BASE = '/api/files';

// Estado del worker
let currentPreload: PreloadSession | null = null;

// Construir URL del stream
const buildStreamUrl = (file: FileInfoPayload): string => {
  const fileName = encodeURIComponent(file.name);
  
  // Extraer folder de file.path (similar a audioWorker)
  // file.path = "folder/archivo.flac" o "folder\archivo.flac"
  let folderParam = '';
  if (file.path && (file.path.includes('\\') || file.path.includes('/'))) {
    const separator = file.path.includes('\\') ? '\\' : '/';
    const parts = file.path.split(separator);
    if (parts.length > 1) {
      // Remover el último elemento (nombre del archivo)
      folderParam = parts.slice(0, -1).join(separator);
    }
  }

  const folderQuery = folderParam ? `&folder=${encodeURIComponent(folderParam)}` : '';
  return `${UPLOAD_API_BASE}/${fileName}/stream?${folderQuery}`;
};

// Crear clave de caché
const getCacheKey = (file: FileInfoPayload): string => {
  return `${file.path}/${file.name}`;
};

// Convertir ArrayBuffer a base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Manejar comandos desde el hilo principal
self.addEventListener('message', async (event: MessageEvent) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'PRELOAD_FILE':
      handlePreloadFile(payload);
      break;

    case 'CANCEL_PRELOAD':
      handleCancelPreload();
      break;

    case 'CLEAR_CACHE':
      handleClearCache();
      break;

    case 'GET_PRELOAD_STATUS':
      sendPreloadStatus();
      break;

    default:
      console.warn(`[filePreloadWorker] Comando desconocido: ${type}`);
  }
});

/**
 * Precargar un archivo a Redis
 */
async function handlePreloadFile(file: FileInfoPayload) {
  try {
    // Si hay una precarga en curso, cancelarla
    if (currentPreload && currentPreload.status === 'loading') {
      currentPreload.abortController?.abort();
    }

    const cacheKey = getCacheKey(file);

    // Verificar si ya existe en Redis
    try {
      const existsResponse = await fetch(`${PRELOAD_API_BASE}/cache/${cacheKey}/exists`);
      const existsData = await existsResponse.json();

      if (existsData.exists) {
        console.log(`[filePreloadWorker] ${file.name} ya está en Redis`);
        self.postMessage({
          type: 'PRELOAD_READY',
          payload: {
            file,
            cacheKey,
            fromCache: true,
          },
        });
        return;
      }
    } catch (error) {
      console.warn('[filePreloadWorker] No se pudo verificar caché:', error);
      // Continuar con la precarga aunque falle la verificación
    }

    // Iniciar precarga
    const streamUrl = buildStreamUrl(file);
    currentPreload = {
      fileName: file.name,
      filePath: file.path,
      streamUrl,
      status: 'loading',
      abortController: new AbortController(),
      progress: 0,
    };

    console.log(`[filePreloadWorker] Precargando: ${file.name}`);

    // Hacer HEAD request para obtener el tamaño sin descargar
    const headResponse = await fetch(streamUrl, {
      method: 'HEAD',
      signal: currentPreload.abortController!.signal,
    }).catch(() => null);

    let fileSizeBytes = 0;
    if (headResponse && headResponse.headers.get('content-length')) {
      fileSizeBytes = parseInt(headResponse.headers.get('content-length') || '0', 10);
    }

    const fileSizeMB = fileSizeBytes / 1024 / 1024;

    // Saltar precarga para archivos > 50MB (ahorra memoria)
    if (fileSizeMB > 50) {
      console.log(`[filePreloadWorker] Archivo muy grande (${fileSizeMB.toFixed(2)}MB) - saltando precarga para no congestionar memoria`);
      self.postMessage({
        type: 'PRELOAD_SKIPPED',
        payload: {
          file,
          reason: 'archivo_muy_grande',
          sizeMB: fileSizeMB,
        },
      });
      return;
    }

    // Intentar descargar el archivo
    const response = await fetch(streamUrl, {
      signal: currentPreload.abortController!.signal,
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    // Leer el buffer
    const buffer = await response.arrayBuffer();

    // Verificar si fue cancelado mientras se descargaba
    if (currentPreload.abortController?.signal.aborted) {
      console.log(`[filePreloadWorker] Precarga cancelada: ${file.name}`);
      return;
    }

    const bufferSize = buffer.byteLength;
    const sizeMB = bufferSize / 1024 / 1024;

    // Guardar en Redis usando la estrategia apropiada
    try {
      // Para archivos >50MB, usar endpoint binario (sin base64)
      if (sizeMB > 50) {
        console.log(`[filePreloadWorker] Archivo grande (${sizeMB.toFixed(2)} MB), usando streaming binario...`);
        
        const saveBinaryResponse = await fetch(`${PRELOAD_API_BASE}/cache/binary?cacheKey=${encodeURIComponent(cacheKey)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          body: buffer, // Enviar buffer directo, sin base64
        });

        if (!saveBinaryResponse.ok) {
          const errorData = await saveBinaryResponse.json();
          throw new Error(errorData.error || `Error HTTP: ${saveBinaryResponse.status}`);
        }

        const saveData = await saveBinaryResponse.json();
        currentPreload.status = 'ready';

        console.log(
          `[filePreloadWorker] Precarga lista (binario): ${file.name} (${sizeMB.toFixed(2)} MB en Redis)`
        );

        self.postMessage({
          type: 'PRELOAD_READY',
          payload: {
            file,
            cacheKey,
            bufferSize,
            fromCache: false,
            method: 'binary',
            redisResponse: saveData,
          },
        });
      } else {
        // Para archivos pequeños <50MB, usar JSON base64 (más simple)
        console.log(`[filePreloadWorker] Archivo pequeño (${sizeMB.toFixed(2)} MB), usando base64...`);
        
        const saveResponse = await fetch(`${PRELOAD_API_BASE}/cache`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cacheKey,
            buffer: arrayBufferToBase64(buffer),
          }),
        });

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json();
          throw new Error(errorData.error || `Error HTTP: ${saveResponse.status}`);
        }

        const saveData = await saveResponse.json();
        currentPreload.status = 'ready';

        console.log(
          `[filePreloadWorker] Precarga lista (base64): ${file.name} (${sizeMB.toFixed(2)} MB en Redis)`
        );

        self.postMessage({
          type: 'PRELOAD_READY',
          payload: {
            file,
            cacheKey,
            bufferSize,
            fromCache: false,
            method: 'base64',
            redisResponse: saveData,
          },
        });
      }
    } catch (redisError) {
      console.warn('[filePreloadWorker] Error guardando en Redis, usando memoria local:', redisError);
      // Fallback: si Redis falla, continuamos sin caché persistente
      currentPreload.status = 'ready';

      self.postMessage({
        type: 'PRELOAD_READY',
        payload: {
          file,
          cacheKey,
          bufferSize,
          fromCache: false,
          warning: 'Redis fallback - sin persistencia',
        },
      });
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[filePreloadWorker] Precarga abortada');
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[filePreloadWorker] Error precargando: ${errorMessage}`);

    if (currentPreload) {
      currentPreload.status = 'error';
      currentPreload.error = errorMessage;
    }

    self.postMessage({
      type: 'PRELOAD_ERROR',
      payload: {
        file,
        error: errorMessage,
      },
    });
  }
}

/**
 * Cancelar precarga en curso
 */
function handleCancelPreload() {
  if (currentPreload && currentPreload.status === 'loading') {
    console.log(`[filePreloadWorker] Cancelando precarga: ${currentPreload.fileName}`);
    currentPreload.abortController?.abort();
    currentPreload.status = 'error';
  }
}

/**
 * Limpiar caché en Redis
 */
async function handleClearCache() {
  try {
    const response = await fetch(`${PRELOAD_API_BASE}/cache`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    console.log('[filePreloadWorker] Caché en Redis limpiado');
    currentPreload = null;

    self.postMessage({
      type: 'CACHE_CLEARED',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[filePreloadWorker] Error limpiando caché:', errorMessage);

    self.postMessage({
      type: 'CACHE_CLEAR_ERROR',
      payload: { error: errorMessage },
    });
  }
}

/**
 * Enviar estado de precarga
 */
async function sendPreloadStatus() {
  try {
    const response = await fetch(`${PRELOAD_API_BASE}/stats`);

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const stats = await response.json();

    self.postMessage({
      type: 'PRELOAD_STATUS',
      payload: {
        hasActivePreload: currentPreload !== null && currentPreload.status === 'loading',
        redisStats: stats,
        currentFile: currentPreload
          ? {
              name: currentPreload.fileName,
              path: currentPreload.filePath,
              status: currentPreload.status,
            }
          : null,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[filePreloadWorker] Redis no disponible:', errorMessage);

    self.postMessage({
      type: 'PRELOAD_STATUS',
      payload: {
        hasActivePreload: currentPreload !== null && currentPreload.status === 'loading',
        redisStats: null,
        redisError: errorMessage,
        currentFile: currentPreload
          ? {
              name: currentPreload.fileName,
              path: currentPreload.filePath,
              status: currentPreload.status,
            }
          : null,
      },
    });
  }
}

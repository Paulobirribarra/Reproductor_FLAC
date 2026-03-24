/**
 * File Preload Worker - Optimized Version
 * 
 * Estrategia "Burst Preload" (Thin Architecture):
 * - Archivos <50MB: precarga completa en Redis
 * - Archivos >50MB: carga solo 5MB inicial + metadatos, streaming desde NVMe
 * - Elimina Base64 completamente
 * - Usa Range Requests para eficiencia
 */

interface PreloadSession {
  fileName: string;
  filePath: string;
  streamUrl: string;
  fileSize: number;
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
const BURST_SIZE_BYTES = 5 * 1024 * 1024; // 5MB para burst preload
const SMALL_FILE_THRESHOLD_MB = 50; // Archivos < 50MB: precarga completa

// Estado del worker
let currentPreload: PreloadSession | null = null;

// Construir URL del stream
const buildStreamUrl = (file: FileInfoPayload): string => {
  const fileName = encodeURIComponent(file.name);

  let folderParam = '';
  if (file.path && (file.path.includes('\\') || file.path.includes('/'))) {
    const separator = file.path.includes('\\') ? '\\' : '/';
    const parts = file.path.split(separator);
    if (parts.length > 1) {
      folderParam = parts.slice(0, -1).join(separator);
    }
  }

  const folderQuery = folderParam ? `folder=${encodeURIComponent(folderParam)}` : '';
  return `${UPLOAD_API_BASE}/${fileName}/stream${folderQuery ? '?' + folderQuery : ''}`;
};

// Crear clave de caché
const getCacheKey = (file: FileInfoPayload): string => {
  return `${file.path}/${file.name}`;
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
 * Precargar un archivo usando estrategia "Burst Preload"
 * 
 * Archivos <50MB: Precarga completa en Redis
 * Archivos >=50MB: Descarga 5MB inicial + metadatos, streaming desde NVMe con Range Requests
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
        console.log(`[filePreloadWorker] ✓ ${file.name} ya está en caché`);
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
    }

    // Obtener tamaño del archivo con HEAD request
    const streamUrl = buildStreamUrl(file);
    const headResponse = await fetch(streamUrl, {
      method: 'HEAD',
    }).catch(() => null);

    let fileSizeBytes = 0;
    if (headResponse && headResponse.headers.get('content-length')) {
      fileSizeBytes = parseInt(headResponse.headers.get('content-length') || '0', 10);
    }

    const fileSizeMB = fileSizeBytes / 1024 / 1024;

    currentPreload = {
      fileName: file.name,
      filePath: file.path,
      streamUrl,
      fileSize: fileSizeBytes,
      status: 'loading',
      abortController: new AbortController(),
      progress: 0,
    };

    console.log(`[filePreloadWorker] Iniciando precarga: ${file.name} (${fileSizeMB.toFixed(2)}MB)`);

    // =========================================
    // ESTRATEGIA: Archivos <50MB = Precarga Completa
    // =========================================
    //  Nota: Redis tiene límite ~512MB por entrada, pero el protocolo RESP
    // puede tener límites menores. Para chunks FLAC >10MB, mejor usar streaming.
    const REDIS_MAX_SIZE_MB = 10; // Límite práctico para Redis
    if (fileSizeMB < REDIS_MAX_SIZE_MB) {
      await preloadSmallFile(file, cacheKey, streamUrl, fileSizeBytes, fileSizeMB);
      return;
    }

    // =========================================
    // ESTRATEGIA: Archivos >=50MB = Burst Preload (5MB + metadatos)
    // =========================================
    await preloadBurstFile(file, cacheKey, streamUrl, fileSizeBytes, fileSizeMB);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[filePreloadWorker] Precarga abortada');
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[filePreloadWorker] Error: ${errorMessage}`);

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
 * Precarga pequeña: Descargar archivo completo y almacenar en Redis
 * Flujo: Descarga completa → Redis metadata + content
 */
async function preloadSmallFile(
  file: FileInfoPayload,
  cacheKey: string,
  streamUrl: string,
  fileSize: number,
  fileSizeMB: number
) {
  try {
    console.log(`[filePreloadWorker] Pequeño archivo: descargando completo (${fileSizeMB.toFixed(2)}MB)`);

    const response = await fetch(streamUrl, {
      signal: currentPreload!.abortController!.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    // Verificar cancelación
    if (currentPreload!.abortController?.signal.aborted) {
      console.log(`[filePreloadWorker] Cancelado: ${file.name}`);
      return;
    }

    // Guardar en Redis con contenido
    try {
      const saveResponse = await fetch(`${PRELOAD_API_BASE}/cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cacheKey,
          metadata: {
            name: file.name,
            path: file.path,
            size: fileSize,
            type: 'complete',
          },
          buffer: serializeBuffer(buffer), // Enviar como typed array, no base64
        }),
      });

      if (!saveResponse.ok) {
        const error = await saveResponse.json();
        throw new Error(error.error || `HTTP ${saveResponse.status}`);
      }

      currentPreload!.status = 'ready';

      console.log(`[filePreloadWorker] ✓ Listo: ${file.name} (${fileSizeMB.toFixed(2)}MB en Redis)`);

      self.postMessage({
        type: 'PRELOAD_READY',
        payload: {
          file,
          cacheKey,
          bufferSize: fileSize,
          fromCache: false,
          strategy: 'complete',
        },
      });
    } catch (redisError: any) {
      //  Redis falló probablemente porque el archivo es demasiado grande
      // para el protocolo RESP o el servidor. Esto es NORMAL para chunks >10MB.
      // Silenciosamente fallback a streaming sin mostrar error.
      const isEntityTooLarge =
        redisError?.message?.includes('entity too large') ||
        redisError?.message?.includes('payload too large') ||
        redisError?.message?.includes('Protocol error');

      if (isEntityTooLarge) {
        console.log(`[filePreloadWorker] ℹ️ Archivo muy grande para Redis (${fileSizeMB.toFixed(2)}MB), usando streaming`);
      } else {
        console.warn('[filePreloadWorker] ⚠️ Redis error (fallback a streaming):', redisError.message);
      }

      // Fallback: continuar sin Redis
      currentPreload!.status = 'ready';
      self.postMessage({
        type: 'PRELOAD_READY',
        payload: {
          file,
          cacheKey,
          warning: 'Streaming sin caché',
        },
      });
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Precarga grande (Burst): Descargar solo 5MB inicial + metadatos
 * El rest se streamea from NVMe con Range Requests
 * Flujo: HEAD → Descarga 5MB burst → Redis metadata + burst
 */
async function preloadBurstFile(
  file: FileInfoPayload,
  cacheKey: string,
  streamUrl: string,
  fileSize: number,
  fileSizeMB: number
) {
  try {
    const burstSizeMB = BURST_SIZE_BYTES / 1024 / 1024;
    console.log(`[filePreloadWorker] Grande archivo: burst preload (5MB + metadatos, streaming NVMe)`);

    // Descargar solo los primeros BURST_SIZE_BYTES usando Range Request
    const rangeUrl = `${streamUrl}`;
    const rangeResponse = await fetch(rangeUrl, {
      headers: {
        'Range': `bytes=0-${BURST_SIZE_BYTES - 1}`,
      },
      signal: currentPreload!.abortController!.signal,
    });

    if (!rangeResponse.ok && rangeResponse.status !== 206) {
      throw new Error(`HTTP ${rangeResponse.status}`);
    }

    const burstBuffer = await rangeResponse.arrayBuffer();
    const burstSizeActual = burstBuffer.byteLength;

    // Verificar cancelación
    if (currentPreload!.abortController?.signal.aborted) {
      console.log(`[filePreloadWorker] Cancelado: ${file.name}`);
      return;
    }

    // Guardar en Redis: metadatos + burst pequeño
    try {
      const saveResponse = await fetch(`${PRELOAD_API_BASE}/cache/burst`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cacheKey,
          metadata: {
            name: file.name,
            path: file.path,
            size: fileSize,
            burstSize: burstSizeActual,
            type: 'burst',
            streamUrl: streamUrl, // Guardar URL para streaming posterior
          },
          burst: serializeBuffer(burstBuffer),
        }),
      });

      if (!saveResponse.ok) {
        const error = await saveResponse.json();
        throw new Error(error.error || `HTTP ${saveResponse.status}`);
      }

      currentPreload!.status = 'ready';

      console.log(
        `[filePreloadWorker] ✓ Listo: ${file.name} (${fileSizeMB.toFixed(2)}MB total) - Burst: ${(burstSizeActual / 1024 / 1024).toFixed(2)}MB en Redis`
      );

      self.postMessage({
        type: 'PRELOAD_READY',
        payload: {
          file,
          cacheKey,
          fileSize,
          burstSize: burstSizeActual,
          fromCache: false,
          strategy: 'burst',
          message: `Usar Range Requests para streaming del resto`,
        },
      });
    } catch (redisError) {
      console.warn('[filePreloadWorker] Redis falló, fallback a streaming puro:', redisError);
      currentPreload!.status = 'ready';
      self.postMessage({
        type: 'PRELOAD_READY',
        payload: {
          file,
          cacheKey,
          warning: 'Streaming puro sin burst',
        },
      });
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Serializar ArrayBuffer para JSON (usando typed array)
 * NOTA: Evitamos Base64 completamente
 */
function serializeBuffer(buffer: ArrayBuffer): any {
  // Para JSON.stringify, convertir a Array para que sea serializable
  return Array.from(new Uint8Array(buffer));
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

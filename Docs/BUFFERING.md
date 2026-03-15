# 📊 Sistema de Buffering - Reproductor FLAC

## ¿Qué es Buffering?

Buffering es la precarga de datos de audio en memoria para garantizar reproducción fluida sin pausas o saltos.

## 🎯 Implementación en el Reproductor

### 1. **Buffering de Reproducción en Tiempo Real**
- **Ubicación**: `Player.tsx` - Evento `progress`
- **Función**: Monitorear cuánto se ha descargado del archivo actual
- **Indicador**: Barra gris que muestra el % descargado
- **Uso**: 
  - `bufferProgress` - Porcentaje de archivo descargado (0-100%)
  - `isBuffering` - Indica si está descargando activamente

### 2. **Precarga del Siguiente Archivo**
- **Ubicación**: `App.tsx` + `usePreloader.ts`
- **Función**: Descargar el próximo archivo de la lista en background
- **Ventaja**: Transición fluida entre canciones sin esperar
- **Comportamiento**:
  1. Cuando reproducces archivo A
  2. Automáticamente empieza a descargar archivo B (después de 2 segundos)
  3. Cuando termina A, B ya está listo
  4. Reproducción instantánea sin pausas

### 3. **Indicadores Visuales**

#### En el Reproductor:
```
🔄 Precargando siguiente archivo... (45%)
```
- Solo aparece cuando está preload del siguiente
- Muestra progreso en tiempo real
- No interfiere con reproducción actual

#### Barras de Progreso:
- **Barra azul clara**: Archivo descargado (buffering actual)
- **Barra azul oscura**: Posición de reproducción
- Se actualizan automáticamente

## 🔧 Cómo Funciona Técnicamente

### Eventos Monitoreados:
1. **loadstart** - Comienza a descargar
2. **progress** - Cada chunk descargado (calcula %)
3. **canplay** - Puede reproducir
4. **loadedmetadata** - Metadata lista (duración, etc)
5. **ended** - Archivo terminó

### Flujo de Datos:
```
Archivo seleccionado
    ↓
Evento: onPlay
    ↓
Buffering comienza (evento progress)
    ↓
SetBufferProgress aumenta (0-100%)
    ↓
Después 2 segundos → Preload siguiente archivo
    ↓
Usuario puede reproducir mientras precarga siguiente
```

## 💡 Ventajas

✅ **Reproducción fluida** - Sin pausas entre canciones
✅ **Experiencia mejorada** - Transiciones instantáneas
✅ **Feedback visual** - Usuario sabe qué está pasando
✅ **No bloquea UI** - Precarga en background
✅ **Eficiente** - Solo precarga el siguiente archivo

## 📈 Casos de Uso

| Caso | Buffering Actual | Precarga Siguiente |
|------|------------------|-------------------|
| Reproducción normal | ✅ Sí | ✅ Sí |
| Saltar canción | ✅ Sí (nueva) | ✅ Sí (nueva siguiente) |
| Mismo archivo 2x | ✅ Sí | ✅ Evita si ya está precargado |
| Última canción | ✅ Sí | ❌ No hay siguiente |

## 🚀 Optimizaciones Futuras

Posibles mejoras:

1. **Cache HTTP** - Guardar archivos en Service Worker
2. **Buffering Adaptativo** - Ajustar según velocidad de red
3. **Precarga Multiple** - Precargar 2-3 archivos siguientes
4. **Calidad Variable** - Descargar menor calidad si lento
5. **Download Manager** - UI para descargas en background

## 📝 Configuración

En `usePreloader.ts` puedes ajustar:

```typescript
// Delay antes de precargar siguiente (ms)
setTimeout(() => {
  preloadFile(nextFile, currentPath);
}, 2000); // ← Cambiar este valor
```

Valores recomendados:
- `1000` (1s) - Muy agresivo
- `2000` (2s) - Recomendado ✅
- `5000` (5s) - Conservador
- `0` - Inmediato (puede ralentizar)

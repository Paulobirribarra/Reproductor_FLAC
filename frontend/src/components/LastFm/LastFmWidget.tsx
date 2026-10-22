import React, { useState, useEffect } from 'react';
import { lastFmApi, type LastFmStatus } from '../../services/api';

export const LastFmWidget: React.FC = () => {
  const [status, setStatus] = useState<LastFmStatus>({
    connected: false,
    username: null,
    scrobblingEnabled: false,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Cargar estado y revisar si volvimos de Last.fm con ?token=...
  useEffect(() => {
    const handleAuthCallbackAndLoadStatus = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (token) {
          console.log('[LastFm] Token recibido desde callback:', token);
          // Limpiar el parámetro de la URL de inmediato para evitar reintentos con token expirado
          urlParams.delete('token');
          const newSearch = urlParams.toString();
          const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
          window.history.replaceState({}, document.title, newUrl);

          setActionLoading(true);
          try {
            await lastFmApi.createSession(token);
            setErrorMsg(null);
          } catch (err: any) {
            console.error('[LastFm] Error al canjear token:', err);
            // Si el backend ya tenía la sesión o falló por token ya usado, no mostrar alerta invasiva
            const errorText = err.response?.data?.error || '';
            if (!errorText.toLowerCase().includes('token')) {
              setErrorMsg(errorText || 'Error al autorizar con Last.fm');
            }
          } finally {
            setActionLoading(false);
          }
        }

        // Consultar estado actual
        const res = await lastFmApi.getStatus();
        if (res.data && res.data.success) {
          setStatus({
            connected: res.data.connected,
            username: res.data.username,
            scrobblingEnabled: res.data.scrobblingEnabled,
            apiKey: res.data.apiKey,
          });
          // Si está conectado exitosamente, limpiar cualquier error previo de token
          if (res.data.connected) {
            setErrorMsg(null);
          }
        }
      } catch (err) {
        console.error('[LastFm] Error cargando status:', err);
      } finally {
        setLoading(false);
      }
    };

    handleAuthCallbackAndLoadStatus();
  }, []);

  // 2. Redirigir a Last.fm para autorizar
  const handleConnect = () => {
    const apiKey = status.apiKey;
    if (!apiKey) {
      alert('Error: La API Key de Last.fm no está configurada en el backend.');
      return;
    }
    // Usamos el origen actual con el puerto donde está el usuario (ej: http://raspi.flicker-mirach.ts.net:5174/)
    const currentOrigin = window.location.origin;
    const authUrl = `https://www.last.fm/api/auth/?api_key=${apiKey}&cb=${encodeURIComponent(currentOrigin)}`;
    window.location.href = authUrl;
  };

  // 3. Desconectar
  const handleDisconnect = async () => {
    if (!window.confirm('¿Seguro que deseas desconectar tu cuenta de Last.fm?')) return;
    try {
      setActionLoading(true);
      await lastFmApi.disconnect();
      setStatus({
        connected: false,
        username: null,
        scrobblingEnabled: false,
        apiKey: status.apiKey,
      });
    } catch (err: any) {
      alert('Error desconectando: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Toggle scrobbling
  const handleToggleScrobble = async () => {
    try {
      const nextState = !status.scrobblingEnabled;
      await lastFmApi.toggleScrobble(nextState);
      setStatus((prev) => ({ ...prev, scrobblingEnabled: nextState }));
    } catch (err: any) {
      alert('Error cambiando scrobble: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) {
    return <div className="text-xs text-zinc-500">Cargando Last.fm...</div>;
  }

  return (
    <div className="flex items-center gap-2">
      {errorMsg && (
        <span className="text-xs text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800">
          {errorMsg}
        </span>
      )}

      {!status.connected ? (
        <button
          onClick={handleConnect}
          disabled={actionLoading}
          className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded shadow transition-colors disabled:opacity-50"
          title="Conectar con Last.fm para scrobble automático"
        >
          <span className="font-bold tracking-tight">Last.fm</span>
          <span>{actionLoading ? 'Conectando...' : 'Conectar'}</span>
        </button>
      ) : (
        <div className="flex items-center gap-2 bg-zinc-800/80 px-2.5 py-1 rounded-md border border-zinc-700 text-xs text-zinc-200">
          <span className="text-red-500 font-bold tracking-wide">Last.fm:</span>
          <a
            href={`https://www.last.fm/user/${status.username}`}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-100 hover:text-white font-medium hover:underline"
            title="Ver perfil en Last.fm"
          >
            @{status.username}
          </a>

          {/* Toggle Scrobble */}
          <button
            onClick={handleToggleScrobble}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
              status.scrobblingEnabled
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-600/50'
                : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
            }`}
            title={status.scrobblingEnabled ? 'Scrobbling activo (clic para pausar)' : 'Scrobbling pausado (clic para reanudar)'}
          >
            {status.scrobblingEnabled ? 'Scrobble: ON' : 'Scrobble: OFF'}
          </button>

          {/* Desconectar */}
          <button
            onClick={handleDisconnect}
            disabled={actionLoading}
            className="text-zinc-400 hover:text-red-400 ml-1 transition-colors"
            title="Desconectar cuenta"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

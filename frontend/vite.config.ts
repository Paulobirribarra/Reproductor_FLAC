import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // Escuchar en todas las interfaces
    port: 5174,
    strictPort: false,
    hmr: {
      // Para desarrollo remoto: usar la IP externa para WebSocket del cliente
      // Pero dentro del container, 0.0.0.0 para binding
      host: process.env.VITE_HMR_HOST || 'localhost',
      port: process.env.VITE_HMR_PORT
        ? parseInt(process.env.VITE_HMR_PORT, 10)
        : 5174,
      protocol: process.env.VITE_HMR_PROTOCOL || 'ws',
    },
    proxy: {
      '/api': {
        target: 'http://reproductor-api:3000',
        changeOrigin: true,
      },
    },
  },
});
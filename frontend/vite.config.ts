import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // Escuchar en todas las interfaces
    port: 5174,
    strictPort: false,
    allowedHosts: [
      'flicker-mirach.ts.net',
      '.ts.net' // Esto permite cualquier dominio de Tailscale
    ],
    hmr: {
      clientPort: 443,
      protocol: 'wss',
    },
    proxy: {
      '/api': {
        target: 'http://reproductor-api:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://reproductor-api:3000',
        changeOrigin: true,
      },
    },
  },
});
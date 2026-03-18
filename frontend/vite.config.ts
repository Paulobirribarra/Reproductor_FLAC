import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // Escuchar en todas las interfaces
    port: 5174,
    hmr: {
      host: process.env.VITE_HMR_HOST || 'localhost',
      port: parseInt(process.env.VITE_HMR_PORT || '5174'),
      protocol: process.env.VITE_HMR_PROTOCOL || 'ws',
    },
    proxy: {
      '/api': {
        target: 'http://reproductor-api:3000',  // Usar hostname del container
        changeOrigin: true,
      },
    },
  },
});
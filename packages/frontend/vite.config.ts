import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import linkPreview from './api/link-preview';

export default defineConfig({
  plugins: [
    react(),
    // Dev: a função da Vercel /api/link-preview roda aqui mesmo (antes do proxy de /api para o backend)
    {
      name: 'link-preview-dev',
      configureServer(server) {
        server.middlewares.use('/api/link-preview', (req, res) => void linkPreview(req, res));
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});

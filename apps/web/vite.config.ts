import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routeFileIgnorePattern: '\\.test\\.(ts|tsx)$',
    }),
    react(),
    tailwindcss(),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/docs': {
        target: 'http://127.0.0.1:3001',
      },
      '/api/auth': {
        target: 'http://127.0.0.1:3001',
      },
      '/api': {
        target: 'http://127.0.0.1:3001',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
});

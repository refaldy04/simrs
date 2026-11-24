import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    strictPort: true,
    proxy: {
      '/api/core/': {
        target: process.env.CORE_API_TARGET ?? 'http://127.0.0.1:8080',
        rewrite: (path) => path.replace(/^\/api\/core/, ''),
      },
      '/api/services/': {
        target: process.env.SERVICES_API_TARGET ?? 'http://127.0.0.1:3000',
        rewrite: (path) => path.replace(/^\/api\/services/, ''),
      },
    },
  },
});

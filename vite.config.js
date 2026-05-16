import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('.', import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Multi-page: index.html = pazarlama landing + inline login,
    // app.html = React PMS (giriş noktası /src/main.jsx)
    rollupOptions: {
      input: {
        main:    resolve(root, 'index.html'),
        app:     resolve(root, 'app.html'),
        modules: resolve(root, 'modules.html'),
        pricing: resolve(root, 'pricing.html'),
        about:   resolve(root, 'about.html'),
        contact: resolve(root, 'contact.html')
      }
    }
  }
});

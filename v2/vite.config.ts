import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Isolated V2 app. Base is relative so the built bundle can be served from any
// sub-path (e.g. a /v2 preview route) without touching the production game.
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
      '@render': fileURLToPath(new URL('./src/render', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
  },
});

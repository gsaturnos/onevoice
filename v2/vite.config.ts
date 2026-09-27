import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';

// Isolated V2 app. Base is relative so the built bundle can be served from any
// sub-path (e.g. a /v2 preview route) without touching the production game.
export default defineConfig({
  base: './',
  server: {
    fs: {
      // Allows importing the card-art handoff package from ../docs/v2/card-assets
      // (the repo's single source of truth for those PNGs — no duplicate copies).
      allow: ['..'],
    },
  },
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
    rollupOptions: {
      // Multi-page build: the existing simulation prototype (index.html) is
      // untouched; card.html is the isolated card-prototype entry point.
      input: {
        main: resolve(__dirname, 'index.html'),
        card: resolve(__dirname, 'card.html'),
        cardGallery: resolve(__dirname, 'card-gallery.html'),
      },
    },
  },
});

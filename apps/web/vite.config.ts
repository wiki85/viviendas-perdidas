import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Minimal service worker: precaches the app shell so the installed PWA
    // opens offline instead of showing the browser's network error. Server
    // rendered routes and data endpoints must NEVER fall back to the shell.
    VitePWA({
      registerType: 'autoUpdate',
      // public/manifest.webmanifest is hand-maintained; don't generate one.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/ciudad/,
          /^\/ciudades/,
          /^\/compartir/,
          /^\/sitemap/,
          /^\/datos/,
          /^\/robots/,
          /^\/\.well-known/,
          /^\/feeds/,
          /^\/boletin\/baja/,
          /^\/prensa/,
        ],
        // Firestore, Maps and Functions stay network-only: no runtime caching.
        runtimeCaching: [],
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 750,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});

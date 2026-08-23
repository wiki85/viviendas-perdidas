import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command, mode }) => {
  // Salvaguarda de despliegue (VP-11): un build de producción con los
  // emuladores activados apuntaría a 127.0.0.1 y activaría el debug token de
  // App Check. Se aborta el build antes de generar ese bundle envenenado.
  if (command === 'build' && mode !== 'development') {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    if (env.VITE_USE_FIREBASE_EMULATORS === 'true') {
      throw new Error(
        'VITE_USE_FIREBASE_EMULATORS=true en un build de producción: abortado. ' +
          'Los emuladores solo valen para desarrollo local (npm run dev).',
      );
    }
  }
  return {
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
            /^\/fuentes/,
            /^\/embed/,
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
  };
});

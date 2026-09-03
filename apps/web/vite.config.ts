import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Copias con nombre estable de las fuentes para las páginas generadas en
// servidor (/ciudad, /fuentes, /prensa, /embed): sus @font-face no pueden
// conocer el hash que Vite añade a los ficheros de la SPA.
const PUBLIC_FONTS: Record<string, string> = {
  'bricolage-grotesque-latin.woff2':
    '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2',
  'bricolage-grotesque-latin-ext.woff2':
    '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-ext-opsz-normal.woff2',
  'instrument-serif-latin.woff2':
    '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2',
  'instrument-serif-latin-ext.woff2':
    '@fontsource/instrument-serif/files/instrument-serif-latin-ext-400-normal.woff2',
};

function copyPublicFonts(): Plugin {
  const require = createRequire(import.meta.url);
  return {
    name: 'copy-public-fonts',
    apply: 'build',
    closeBundle() {
      const target = fileURLToPath(new URL('./dist/fonts', import.meta.url));
      mkdirSync(target, { recursive: true });
      for (const [name, source] of Object.entries(PUBLIC_FONTS)) {
        copyFileSync(require.resolve(source), join(target, name));
      }
    },
  };
}

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
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
          // Las copias de /fonts son para las páginas de servidor; la SPA ya
          // precachea sus propias fuentes con hash.
          globIgnores: ['fonts/**'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            // Firebase reserved namespace: the auth popup/redirect helpers
            // (/__/auth/*) must reach the network, never the app shell.
            /^\/__\//,
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
      copyPublicFonts(),
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

# CLAUDE.md

Guía para Claude Code en **Viviendas Perdidas** (producción: https://www.aquiviviamos.com, proyecto Firebase `mapa-de-despoblacion`). Web colaborativa, mobile-first y **sin cuentas de usuario** que visibiliza cuántas viviendas, familias y habitantes ha perdido cada barrio por el uso turístico de inmuebles.

## Invariantes de negocio (no romper jamás)

- **Fórmula de conteo:** un inmueble aporta `dwellingsCount` viviendas y familias (0 si `type = commercial`); habitantes = `round(dwellingsCount × 2,5)`; un local comercial convertido aporta 1 local perdido y 0 viviendas.
- **Dos capas que nunca se suman en un mismo contador:** registros vecinales (colaborativos) y capa oficial (espejos de registros autonómicos de viviendas turísticas).
- **Agregados:** siempre deltas transaccionales e idempotentes (`functions/src/triggers/on-listing-write.ts`). Cambiar un registro de estado, ámbito o nº de viviendas revierte primero su contribución anterior. Los eventos se deduplican en `processedListingEvents`.
- **Moderación por votos:** 5 reportes y más del doble de reportes que confirmaciones → `flagged`; 15 reportes → `removed` (deja de aparecer y de contar). Los votos son transaccionales e idempotentes.
- **Habitaciones (rooms-only) de la capa oficial:** ≈1 habitante desplazado por habitación (habitaciones ≈ plazas ÷ 2, mínimo 1); nunca cuentan como hogar. Los edificios de apartamentos aportan sus viviendas reales (`units`), no 1.
- **Privacidad:** sin cuentas, sin analítica de terceros. El UUID de `localStorage` solo sale del navegador con SHA-256. Notas de 280 caracteres; el servidor rechaza HTML, URLs, emails y teléfonos. Sin PII en logs (`services/error-log.ts`). Las fotos pierden el EXIF en servidor.
- **Escrituras:** Firestore y Storage no admiten escrituras directas desde cliente. Todo pasa por Functions con App Check (`enforceAppCheck`) y rate limiting (`services/rate-limit.ts`). No debilitar nunca esos dos controles.

## Restricciones operativas

- **Verificación dinámica SOLO contra emuladores locales** (`npm run emulators` + seed). Jamás contra el proyecto desplegado ni contra APIs de Google con credenciales reales.
- La clave de servidor de Maps vive solo en el secreto de Functions `GOOGLE_MAPS_SERVER_API_KEY`. Jamás en variables `VITE_*` (esas son públicas por diseño).
- **Orden de despliegue:** `firestore:rules,firestore:indexes` → `functions` → `hosting`. Usa la skill `/desplegar`.
- **Regiones:** todo en `europe-southwest1`, salvo los jobs programados en `europe-west1` (Cloud Scheduler no opera en Madrid). No «corregir» esa asimetría.
- `Security Assessment/` es privado y solo local (gitignored): la auditoría de seguridad es de solo lectura sobre el código y sus entregables viven únicamente ahí.

## Comandos (desde la raíz)

```bash
npm run dev            # frontend en http://localhost:5173 (sin .env → modo demo)
npm run typecheck      # TS en workspaces + scripts
npm run lint           # ESLint, --max-warnings 0 (un warning rompe el CI)
npm run format:check   # Prettier
npm test               # tests unitarios (vitest) en todos los workspaces
npm run build          # web + functions + scripts (functions ejecuta sync:geo en prebuild)
npm run emulators      # Hosting + Firestore + Functions locales
npm run test:integration                       # requiere emulador de Firestore, o:
firebase emulators:exec --only firestore --project demo-viviendas-perdidas "npm run test:integration"
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed:demo -- --project demo-viviendas-perdidas
npm run geo:import -- --input <geojson> --city-id <id> ...   # ver /nueva-ciudad
node scripts/estado-fuentes.mjs                # estado de las sincronizaciones oficiales
```

Un solo test: `npx vitest run <fichero.test.ts>` **dentro del workspace correspondiente** (`apps/web` o `functions`). En `functions`, `pretest` ejecuta `sync:geo` automáticamente.

## Mapa del código

- `apps/web/src/components/` — UI (mapa en `map/`, ficha `ListingSheet`, alta `RegisterWizard`, capa oficial `OfficialSheet`/`OfficialStackSheet`, panel `/admin` en `AdminPage`).
- `apps/web/src/hooks/` — ámbito visible, agregados, listings por viewport, Street View.
- `apps/web/src/lib/` — config, geodatos, privacidad, `official-sources.ts` (atribuciones por fuente; mantener en sincronía con MethodologyPage, AboutPage y README).
- `apps/web/src/services/` — `firebase-service.ts` (modo conectado) y `demo-service.ts` (modo demo en memoria/localStorage). Ambos implementan la misma interfaz (`index.ts`).
- `functions/src/callables/` — `create-listing`, `vote-listing`, `photos` (moderación previa), `contact`, `newsletter`, `admin-listings` (autorización por `ADMIN_EMAILS` + Google Sign-In).
- `functions/src/http/` — HTML/feeds generados en servidor: `share-scope`, `embed`, `public-pages` (`/ciudad/*`, `/fuentes`, `/prensa`, sitemap), `export-public-data`. Todo texto interpolado pasa por los helpers de escape de `html.ts`.
- `functions/src/domain/` — lógica pura y testeable: agregados, moderación, duplicados, sanitización, y un parser por comunidad autónoma (`openrta.ts`, `catalunya.ts`, `murcia.ts`…) con test gemelo.
- `functions/src/services/` — un `*-source.ts` por registro autonómico (descarga y fetcher), `official-sync.ts` (registro de fuentes, listas `SYNCED_*`, runner diferencial con purga acotada), `geocoding.ts` + caché `officialGeoCache`, `rate-limit.ts`.
- `functions/src/scheduled/sync-openrta.ts` — un job semanal por fuente, escalonados para no contender por el lock de sincronización.
- `firestore.rules` / `storage.rules` — lectura pública filtrada (los `removed` son indescubribles), escrituras cliente denegadas; en Storage solo `public/` es legible. Cualquier cambio aquí es sensible: revisar con máximo cuidado.
- `scripts/` — importación de GeoJSON, seed de demo y diagnóstico.

## Convenciones

- **Commits en español**, en presente, descriptivos del efecto («La CSP tapa el clickjacking…»). Sin prefijos tipo `feat:`.
- Textos de interfaz y documentación en español; comentarios de código en el idioma del fichero circundante.
- Cada parser de `domain/` lleva fixtures reales en su test; los servicios `*-source.ts` incluyen un umbral `MIN_EXPECTED_*` contra descargas truncadas.
- Al añadir o cambiar una fuente oficial es **obligatorio** actualizar las atribuciones (README, `/fuentes` en `render-sources.ts`, `apps/web/src/lib/official-sources.ts`): lo exigen las licencias CC BY.

## Skills del proyecto

- `/nueva-fuente-oficial` — añadir el espejo de un registro autonómico (la tarea más frecuente).
- `/verificar` — cadena completa de calidad en el orden correcto.
- `/desplegar` — despliegue seguro con smoke tests contra producción.
- `/nueva-ciudad` — importar límites de barrios de una ciudad nueva.
- `/auditoria-seguridad` — auditoría según la metodología de `Security Assessment/`.

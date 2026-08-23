---
name: nueva-fuente-oficial
description: Añadir el espejo de un nuevo registro autonómico/insular de viviendas turísticas a la capa oficial. Usar cuando el usuario pida integrar una comunidad autónoma, provincia o isla nueva, o ampliar municipios de una fuente existente.
---

# Añadir una fuente oficial

Integrar un registro oficial nuevo sigue siempre el mismo patrón de 15 fuentes ya existentes (`rta`, `cat`, `gva`, `caib`, `nav`, `eus`, `mad`, `can`, `mur`, `men`, `gal`, `cyl`, `ara`, `clm`, `ext`). Antes de escribir código, estudia 1–2 integraciones recientes como plantilla (`git log --oneline` las delata; `murcia` y `extremadura` son buenos ejemplos).

## 1. Investigación del dataset

1. Localiza el dataset en el portal de datos abiertos autonómico (o datos.gob.es). Muestrea con `curl`/WebFetch **con límites** (`-m`, `$limit=`, `limit=`…), nunca descargas masivas repetidas.
2. Anota: formato (API JSON/Socrata/CKAN, CSV, GeoJSON, tabla HTML tipo `.xls`), codificación (¡varios portales sirven ISO-8859-1!), campos disponibles y **licencia exacta**.
3. Campos que buscamos: nº de registro estable (identidad del doc), dirección, municipio, plazas, tipo (vivienda completa / habitaciones / apartamento / operador), y coordenadas **o** referencia catastral.
4. Decide el carril de ubicación, por prioridad: coordenadas nativas (¿en qué CRS? reproyectar con `proj4` si no es WGS84) → referencia catastral vía `Consulta_CPMRC` (gratis, caché `catastro-*` en `officialGeoCache`) → geocodificación por dirección (CartoCiudad/Google, cacheada).
5. Decide qué filas son viviendas turísticas de verdad: excluye operadores/comercializadores; las habitaciones suman habitantes pero no hogares (`entire = false`); los edificios de apartamentos aportan sus viviendas reales (`units`).
6. Elige los municipios a espejar (los de mayor volumen) y comprueba si ya tienen GeoJSON en `apps/web/public/geo/` (si no, el desglose por barrios no funcionará; ofrece `/nueva-ciudad` como paso opcional).

## 2. Parser de dominio (lógica pura, testeable)

- `functions/src/domain/<region>.ts`: lista de municipios `{ sourceName, name, cityId }`, parseo de fila cruda → `OfficialVutRecord` (tipo en `domain/openrta.ts`). Reutiliza los helpers existentes: `normalizeLicenseKey`, `sanitizePublicName`, `extractStreetNumber` (de `openrta.ts`) y `normalizeStreet`/`normalizeStreetNumber` (de `address.ts`). Devuelve `null` ante filas inutilizables, nunca datos erróneos.
- `functions/src/domain/<region>.test.ts`: test gemelo con **fixtures reales** copiadas del muestreo (incluye casos raros: tildes, filas vacías, tipos excluidos, coordenadas ausentes).

## 3. Servicio de descarga

- `functions/src/services/<region>-source.ts`: URLs del export, fetcher con `prepare`/`fetchMunicipality` (interfaz de `OfficialSource`), buckets por municipio, y un umbral `MIN_EXPECTED_<REGION>_ROWS` que aborte ante descargas truncadas (mira `murcia-source.ts` como modelo).
- Si el portal pagina (Socrata/CKAN), respeta sus límites; si sirve un fichero único, descárgalo una vez y reparte en buckets.

## 4. Registro en el runner

En `functions/src/services/official-sync.ts`:

- añade el id a `OfficialSourceId`;
- crea la entrada `OfficialSource` con `idPrefix` **único** (delimita la purga de fantasmas: jamás reutilizar uno existente), `statsSource` (lo que verán las páginas de ciudad) y su lista `SYNCED_<REGION>_MUNICIPALITIES`.

## 5. Job programado

En `functions/src/scheduled/sync-openrta.ts`:

- crea `sync<Region>` con `onSchedule`: `region: SCHEDULER_REGION` (`europe-west1`, Cloud Scheduler no existe en `europe-southwest1`), `timeoutSeconds: 1500`, `memory: '1GiB'`, `timeZone: 'Europe/Madrid'`, `secrets: [googleMapsServerApiKey]`;
- elige un **hueco libre** mirando los `schedule:` existentes (están escalonados en tandas de 04:30, 05:30 y 06:30 para no contender por el lock de sincronización);
- exporta la función en `functions/src/index.ts`;
- comprueba si `runAllOfficialSyncs` / `adminSyncOfficialData` recogen la fuente automáticamente desde el registro (deberían).

## 6. Atribución y documentación (OBLIGATORIO por licencia)

Las licencias CC BY y equivalentes exigen crédito y lista de modificaciones. Actualiza **los cuatro sitios**:

1. `README.md`: fila en la tabla de fuentes, párrafo de atribución, lista de modificaciones (qué se filtra, cómo se obtienen coordenadas), sincronización (día/hora del job, descarga inicial con recuento aproximado) y mención en «Sin respaldo oficial».
2. `functions/src/http/render-sources.ts` (página pública `/fuentes`): entrada con licencia y puntuación por criterios; actualiza `render-sources.test.ts`.
3. `apps/web/src/lib/official-sources.ts`: nuevo `OfficialSourceInfo` (añade el id a la unión) con `registerName`, `registerUrl`, `publisher`, licencia y `coordinatesCredit` si las coordenadas vienen de un tercero (Catastro, CartoCiudad, ayuntamiento).
4. `MethodologyPage`/`AboutPage` si enumeran fuentes.

## 7. Verificación

1. `npm test` en `functions` (o `npx vitest run functions/src/domain/<region>.test.ts` desde `functions/`).
2. `npm run typecheck && npm run lint` desde la raíz.
3. Muestreo real final contra la API para confirmar que los recuentos por municipio son plausibles frente a lo esperado.
4. NO ejecutar la sincronización contra producción: eso lo hará el job programado o el usuario vía `adminSyncOfficialData` tras desplegar con `/desplegar`.

Al terminar, resume: fuente, municipios, carril de coordenadas, día del scheduler, y recuerda que el primer despliegue debe ir seguido de una sincronización manual (`adminSyncOfficialData`) si no se quiere esperar al job semanal.

# Backlog

Mejoras identificadas y pendientes de implementar. Al completar una, muévela al historial de git (el commit es el registro).

## CCAA pendientes

- **Fases 1-4 implementadas el 24-08-2026** (fuentes `eiv`, `cnt`, `lrj`, `gij`, `avi`); la investigación queda en [PLAN-CCAA-PENDIENTES.md](PLAN-CCAA-PENDIENTES.md). Siguen vivas las **gestiones administrativas**: solicitud de reutilización a Formentera (turisme@formentera.es, citando el Reglament 1/2015), solicitud del REAT al Principado de Asturias (cubriría Oviedo, Llanes, Ribadesella y sustituiría los espejos municipales), validación formal de la licencia del Decreto 87/2013 con Cantabria y petición al Ayuntamiento de Gijón del alta de su visor como dataset con licencia.
- **Vigilancia de frescura de Cantabria:** comprobar 2-3 semanas si el recuento de la capa (806 el 24-08) crece con las regularizaciones del Decreto 50/2025; si se congela, contactar con la DG de Turismo y valorar rebajar su puntuación de frecuencia en `/fuentes`.

## Fuentes oficiales

- **Cataluña: usar la referencia catastral como carril gratuito del Catastro.** Desde 2026 el dataset Socrata del RTC publica la columna `referencia_cadastral` (~19% de altas en Barcelona, ~20% en Girona, ~11% en Tarragona, verificado el 24-08-2026). Añadirla al `$select` de `services/catalunya-source.ts` y mapearla a `cadastralRef` en `domain/catalunya.ts` daría a Girona y Tarragona el mismo carril gratuito de coordenadas por Catastro que ya usa la fuente valenciana (`repairViaCatastro`), reduciendo la dependencia de CartoCiudad y de la geocodificación comercial. Al hacerlo, actualizar la entrada `cat` de `/fuentes` (http/render-sources.ts) y valorar si sube su puntuación de «Ubicación».

## Panel de administración

- **Callable por fuente para reparaciones dirigidas.** Hoy la única palanca del panel es la pasada completa de 15 fuentes; un callable que reciba el `OfficialSourceId` permitiría reparar una sola fuente (como exigió la rotura de Murcia del 24-08-2026) sin pagar las otras catorce ni recurrir a forzar el job en Cloud Scheduler.
- **Reconstrucción incremental de celdas.** `rebuildCells` lee los ~178k registros de `officialVut` en cada pasada (~50 s). Recalcular solo las celdas geohash que intersectan los municipios de la fuente sincronizada lo dejaría en segundos; es el premio gordo a largo plazo.

- **El botón de sincronización manual muestra «deadline-exceeded» aunque el sync siga vivo.** El SDK cliente de Firebase corta la espera del callable `adminSyncOfficialData` a los ~70 segundos, pero la función sigue ejecutándose en el servidor (timeout propio de 1500 s) — visto el 24-08-2026. Opciones: pasar `{ timeout: 1_500_000 }` al `httpsCallable`, o mejor, convertir el botón en «lanzar y consultar» (disparar el sync y refrescar el estado leyendo `officialStats.updatedAt` en vez de esperar la respuesta).

## Vigilancia (no requiere código, revisar en unas semanas)

- **Catálogo CAIB (Mallorca y Menorca):** declara refresco diario automático pero ambos GeoJSON llevan sin regenerarse desde el 07-08-2026. Si sigue congelado, reflejarlo en las fichas de `/fuentes`.
- **Coordenadas de Barcelona (Open Data BCN):** el recurso declara frecuencia semanal pero su `last_modified` es del 21-05-2026; las altas HUT posteriores quedan sin coordenadas municipales hasta que se regenere.
- **Licencia de OpenRTA:** la ficha de datos.gob.es declara como licencia el aviso legal de la Junta, sin CC BY explícita en los metadatos máquina. Verificar humanamente si la CC BY 4.0 que citamos sigue siendo la licencia vigente del dataset.
- **Murcia, columna «Nº VIV»:** el listado del ITREM añadió esa columna (hoy siempre «1»). Si algún día declara más de una vivienda por fila, habría que leerla para no infracontar.

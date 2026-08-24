# Backlog

Mejoras identificadas y pendientes de implementar. Al completar una, muévela al historial de git (el commit es el registro).

## Fuentes oficiales

- **Cataluña: usar la referencia catastral como carril gratuito del Catastro.** Desde 2026 el dataset Socrata del RTC publica la columna `referencia_cadastral` (~19% de altas en Barcelona, ~20% en Girona, ~11% en Tarragona, verificado el 24-08-2026). Añadirla al `$select` de `services/catalunya-source.ts` y mapearla a `cadastralRef` en `domain/catalunya.ts` daría a Girona y Tarragona el mismo carril gratuito de coordenadas por Catastro que ya usa la fuente valenciana (`repairViaCatastro`), reduciendo la dependencia de CartoCiudad y de la geocodificación comercial. Al hacerlo, actualizar la entrada `cat` de `/fuentes` (http/render-sources.ts) y valorar si sube su puntuación de «Ubicación».

## Vigilancia (no requiere código, revisar en unas semanas)

- **Catálogo CAIB (Mallorca y Menorca):** declara refresco diario automático pero ambos GeoJSON llevan sin regenerarse desde el 07-08-2026. Si sigue congelado, reflejarlo en las fichas de `/fuentes`.
- **Coordenadas de Barcelona (Open Data BCN):** el recurso declara frecuencia semanal pero su `last_modified` es del 21-05-2026; las altas HUT posteriores quedan sin coordenadas municipales hasta que se regenere.
- **Licencia de OpenRTA:** la ficha de datos.gob.es declara como licencia el aviso legal de la Junta, sin CC BY explícita en los metadatos máquina. Verificar humanamente si la CC BY 4.0 que citamos sigue siendo la licencia vigente del dataset.
- **Murcia, columna «Nº VIV»:** el listado del ITREM añadió esa columna (hoy siempre «1»). Si algún día declara más de una vivienda por fila, habría que leerla para no infracontar.

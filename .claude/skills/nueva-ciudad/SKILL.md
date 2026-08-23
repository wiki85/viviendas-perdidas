---
name: nueva-ciudad
description: Importar los límites de barrios (GeoJSON) de una ciudad nueva para que sus polígonos, desglose por barrio y cambio de ámbito funcionen en el mapa. Usar cuando el usuario quiera añadir una ciudad o actualizar sus límites administrativos.
---

# Añadir o actualizar una ciudad

El importador normaliza un `FeatureCollection` de polígonos/multipolígonos de barrios y actualiza el manifiesto geográfico. El `build` de `functions` sincroniza después ese manifiesto al paquete desplegable (`sync:geo`), de modo que cliente y servidor resuelven el mismo barrio.

## 1. Conseguir la fuente

1. Descarga los límites administrativos (barrios/distritos) del **portal municipal oficial**. Anota URL, licencia y fecha de descarga: son obligatorias en la documentación del proyecto.
2. Inspecciona el GeoJSON: nombre del campo identificador (`--id-field`, p. ej. `COD_BARRIO`) y del campo nombre (`--name-field`, p. ej. `NOMBRE`). Confirma que la geometría es WGS84 (lat/lon); si viene en UTM, reproyéctala antes.

## 2. Importar

```bash
npm run geo:import -- \
  --input ./datos/barrios-<ciudad>.geojson \
  --city-id <ciudad> \
  --city-name <Ciudad> \
  --id-field <CAMPO_ID> \
  --name-field <CAMPO_NOMBRE> \
  --output-dir apps/web/public/geo/<ciudad>
```

El script conserva solo polígonos válidos, normaliza propiedades a `{ id, name, cityId }`, redondea coordenadas para reducir peso y actualiza `apps/web/public/geo/manifest.json` con un nombre con hash de contenido.

## 3. Verificar

1. Revisa el `manifest.json`: la ciudad aparece con su fichero hasheado.
2. `npm run build` (ejecuta `sync:geo` en el prebuild de `functions`): confirma que el manifiesto y sus ficheros se copian al paquete de `functions`.
3. Arranca `npm run dev` y comprueba en el mapa: buscar la ciudad cambia el ámbito, los polígonos de barrio se dibujan y los contadores responden al mover el centro.
4. Si la ciudad ya tiene fuente oficial espejada, tras desplegar habrá que re-sincronizarla para que `officialStats.neighborhoods` recalcule el desglose por los nuevos polígonos.

## 4. Documentar

Registra en el proyecto la URL del portal municipal, la licencia y la fecha de descarga del GeoJSON de origen.

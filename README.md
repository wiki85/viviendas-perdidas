# Viviendas Perdidas

Aplicación web colaborativa, mobile-first y sin cuentas para hacer visible cuántas viviendas, familias y habitantes ha perdido cada barrio por el uso turístico de inmuebles.

La aplicación está preparada para funcionar de dos formas:

- **Modo demo local:** no requiere credenciales. Permite recorrer el producto, buscar zonas semilla, abrir fichas, registrar inmuebles y votar en memoria/localStorage.
- **Modo conectado:** activa Google Maps, Places, Street View, Firestore, Cloud Functions v2 y App Check al configurar las variables de entorno.

> Los datos incluidos son demostrativos. Los polígonos simplificados del repositorio sirven para desarrollo y deben sustituirse por límites oficiales antes de presentar cifras públicas.

## Arquitectura

```text
apps/web/                 React 18 + Vite + TypeScript + TailwindCSS
  public/geo/             GeoJSON normalizados y manifiesto de ciudades
  src/components/         Mapa, barra superior, ficha y asistente de alta
  src/hooks/              Ámbito visible, agregados y listings en viewport
  src/lib/                Firebase, geodatos, Street View y modo demo
functions/                Cloud Functions v2 y lógica de dominio
scripts/                  Importación de GeoJSON y seed de demostración
firestore.rules           Lectura pública filtrada; todas las escrituras denegadas
firebase.json             Hosting, Functions, Firestore y emuladores
```

No existe autenticación de usuarios. El navegador conserva únicamente un UUID aleatorio local; antes de enviarlo se transforma mediante SHA-256. No se guardan nombres, correos, IP ni identificadores reales del dispositivo.

## Requisitos

- Node.js 22 LTS
- npm 10 o superior
- Java 21 o superior para el emulador de Firestore
- Firebase CLI (`npm i -g firebase-tools`) para emuladores y despliegue
- Un proyecto Firebase en plan Blaze para desplegar Cloud Functions
- Una clave de navegador de Google Maps restringida por _HTTP referrer_
- Una clave de servidor de Google Maps guardada como secreto de Functions

## Inicio rápido

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. Sin `.env`, el frontend arranca automáticamente en modo demo.

Comandos principales:

```bash
npm run dev          # frontend
npm run build        # frontend + Functions + scripts
npm run test         # tests unitarios
npm run lint         # ESLint en todos los workspaces
npm run format:check # Prettier
npm run emulators    # Hosting, Firestore y Functions locales
```

## Configuración del frontend

Copia el ejemplo y completa los valores públicos de tu aplicación web Firebase:

```bash
cp apps/web/.env.example apps/web/.env.local
```

```dotenv
VITE_DEMO_MODE=false
VITE_GOOGLE_MAPS_API_KEY=
VITE_GOOGLE_MAPS_MAP_ID=DEMO_MAP_ID
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_RECAPTCHA_V3_SITE_KEY=
VITE_FIREBASE_REGION=europe-southwest1
VITE_USE_FIREBASE_EMULATORS=false
VITE_PUBLIC_EXPORT_URL=
```

En Google Cloud habilita para la clave del navegador:

1. Maps JavaScript API.
2. Places API (New).
3. Geocoding API.
4. Street View Static API.

Restringe la clave a los dominios de Hosting y desarrollo autorizados, y después limita su uso a esas cuatro APIs. `VITE_GOOGLE_MAPS_MAP_ID` puede ser un Map ID propio; `DEMO_MAP_ID` es adecuado únicamente para desarrollo.

App Check se inicializa solo cuando existe `VITE_RECAPTCHA_V3_SITE_KEY`. En desarrollo puedes registrar un token de depuración siguiendo la documentación de Firebase, pero no desactives `enforceAppCheck` en producción.

## Configuración de Firebase

```bash
cp .firebaserc.example .firebaserc
firebase use --add
firebase functions:secrets:set GOOGLE_MAPS_SERVER_API_KEY
```

La clave de servidor debe tener restringidas Geocoding API y Street View Static API. No la expongas mediante variables `VITE_*`.

Inicializa Firestore y despliega los índices antes de las Functions:

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
firebase deploy --only hosting
```

Las callables rechazan peticiones sin App Check válido. `createListing` limita altas por hash efímero del token y dispositivo, mientras que `voteListing` aplica un límite separado. Los documentos internos de rate limit y deduplicación de eventos no son legibles desde cliente.

El despliegue de índices activa TTL sobre `rateLimits.expiresAt` y `processedListingEvents.expiresAt`, evitando que esos documentos técnicos crezcan indefinidamente. Las eliminaciones TTL tienen la tarificación propia de Firestore.

## Emuladores y seed

En una terminal:

```bash
npm run emulators
```

En otra:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed:demo -- --project demo-viviendas-perdidas
```

Activa `VITE_USE_FIREBASE_EMULATORS=true` para conectar el frontend. App Check usa el flujo de depuración local; las reglas siguen bloqueando escrituras directas y las altas pasan por Functions.

## Añadir o actualizar una ciudad

El importador acepta `FeatureCollection` de polígonos o multipolígonos:

```bash
npm run geo:import -- \
  --input ./datos/barrios.geojson \
  --city-id sevilla \
  --city-name Sevilla \
  --id-field COD_BARRIO \
  --name-field NOMBRE \
  --output-dir apps/web/public/geo/sevilla
```

El script:

- conserva solo geometrías de polígonos válidas;
- normaliza las propiedades a `{ id, name, cityId }`;
- redondea coordenadas para reducir peso;
- genera un nombre con hash de contenido y actualiza `manifest.json`.

`npm run build` sincroniza automáticamente el manifiesto y sus ficheros con el paquete desplegable de `functions`; cliente y servidor resuelven así exactamente el mismo barrio sin mantener una segunda copia manual. Conserva en la documentación del proyecto la URL, licencia y fecha de descarga del portal municipal de origen.

## Modelo y reglas de conteo

Un inmueble individual aporta una vivienda; un edificio aporta el número declarado (entre 1 y 500); un local comercial convertido en alojamiento turístico aporta un local perdido y ninguna vivienda:

```text
viviendas perdidas = dwellingsCount        (0 si type = commercial)
familias perdidas  = dwellingsCount        (0 si type = commercial)
habitantes         = round(dwellingsCount × 2,5)
locales perdidos   = 1 si type = commercial
```

`onListingWrite` mantiene los agregados de municipio y barrio mediante deltas transaccionales. El evento se registra de forma idempotente para impedir dobles incrementos ante reintentos. Pasar un registro a `removed`, cambiarlo de ámbito o modificar su número de viviendas revierte primero su contribución anterior.

Los votos también son transaccionales e idempotentes. Con 5 reportes y más del doble de reportes que confirmaciones el registro pasa a `flagged`; con 15 reportes pasa a `removed` y deja de aparecer y contar.

## Fotos de la comunidad y moderación previa

Cuando Street View no muestra bien la fachada, cualquier persona puede enviar una foto desde la ficha del inmueble. El flujo es de aprobación previa obligatoria:

- El cliente reduce la imagen a 1600 px y la reexporta a JPEG por canvas, lo que elimina los metadatos EXIF (GPS, dispositivo) antes de salir del navegador.
- `submitListingPhoto` (App Check + rate limit) valida tamaño y formato y la guarda en `pending/` de Cloud Storage, ilegible desde cliente.
- El panel `/admin` requiere iniciar sesión con Google; solo los correos de la variable `ADMIN_EMAILS` de Functions (por defecto, el del propietario) pueden listar, aprobar o rechazar.
- Al aprobar, la foto se copia a `public/` (lectura pública, caché inmutable) y la ficha la muestra como «Foto de la comunidad»; al rechazar, se elimina el archivo.

Para activarlo en un proyecto: habilita **Storage** y el proveedor **Google** de Authentication en la consola de Firebase, y despliega `storage.rules` junto con las Functions.

## Privacidad y moderación

- No hay cuentas, analítica de terceros ni cookies propias de seguimiento.
- El UUID aleatorio de `localStorage` no sale del navegador sin hash y solo sirve para impedir votos repetidos de forma blanda.
- Las notas tienen 280 caracteres y el servidor rechaza HTML, URLs, emails y patrones de teléfono.
- Firestore no admite escrituras directas desde la web.
- Google Maps sí puede usar almacenamiento/cookies propios; la interfaz lo informa y enlaza su política.
- Los datos son colaborativos y no oficiales. Un reporte no acusa a personas: marca un inmueble para revisión.

## Rendimiento y coste orientativo

La interfaz carga el SDK de Maps solo cuando hay clave, consulta como máximo 500 registros por viewport y lee un único agregado por cambio de ámbito. Los GeoJSON llevan caché `immutable`; Street View usa imágenes estáticas `400×300` y consulta antes el endpoint gratuito de metadata.

Los enlaces `/compartir/{scopeId}` se sirven mediante una Function que lee un agregado y genera Open Graph en servidor; después redirigen al mismo ámbito del mapa. Así los crawlers sociales reciben los contadores aunque no ejecuten la SPA.

Desde marzo de 2025 Google Maps ya no usa el antiguo crédito mensual único de 200 USD: cada SKU tiene una cuota gratuita propia. A julio de 2026, Dynamic Maps, Static Street View, Geocoding y Autocomplete Requests incluyen 10.000 eventos mensuales gratuitos por SKU; Street View Metadata no tiene coste. Por tanto, **1.000 visitas/mes suelen costar 0 USD** si cada visita carga un mapa y el resto de llamadas permanece bajo sus cuotas. Superado el tramo gratuito, como referencia global:

| Operación             | Precio de lista por 1.000 eventos adicionales |
| --------------------- | --------------------------------------------: |
| Dynamic Maps          |                                      7,00 USD |
| Static Street View    |                                      7,00 USD |
| Geocoding             |                                      5,00 USD |
| Autocomplete Requests |                                      2,83 USD |

Firestore incluye diariamente 50.000 lecturas, 20.000 escrituras y 20.000 borrados, además de 1 GiB almacenado. Los precios y condiciones cambian: verifica siempre las páginas oficiales de [Google Maps Platform](https://developers.google.com/maps/billing-and-pricing/pricing) y [Cloud Firestore](https://firebase.google.com/docs/firestore/pricing), configura presupuestos y alertas, y fija cuotas por API antes del lanzamiento.

## Pruebas y criterios de salida

```bash
npm test
npm run build
firebase emulators:exec --only firestore --project demo-viviendas-perdidas "npm run test:integration"
```

Los tests unitarios cubren cálculo de contribuciones y deltas, transiciones de moderación, detección geográfica de duplicados, resolución punto-polígono, validación de notas y utilidades del frontend. Antes de producción conviene completar un recorrido manual móvil:

1. Buscar “Ruzafa” o “46006” y comprobar el cambio de ámbito.
2. Mover el centro entre barrios y verificar contadores/polígono.
3. Registrar un edificio de 12 viviendas y comprobar el incremento `+12 / +12 / +30`.
4. Repetir el portal y confirmar que se ofrece el registro existente.
5. Votar desde el mismo navegador dos veces y comprobar la idempotencia.
6. Alcanzar los umbrales de moderación en emulador y verificar que los agregados se revierten.

## Despliegue seguro

Antes de `firebase deploy`:

- sustituye los límites de demostración por GeoJSON municipales oficiales;
- configura App Check y activa enforcement también desde Firebase Console;
- restringe ambas claves de Maps y define alertas de facturación;
- revisa los índices y ejecuta tests con emuladores;
- actualiza los textos legales con asesoramiento aplicable al despliegue real;
- valida accesibilidad con teclado, VoiceOver/TalkBack y contraste AA.

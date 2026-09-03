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
  src/components/         Mapa, HUD (buscador, cifras y dock inferior), fichas y asistente de alta
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

## Fuentes de datos y licencias

El mapa combina dos fuentes que **nunca se suman en un mismo contador**: los registros **vecinales** (colaborativos) y, en la capa **oficial**, los registros públicos de viviendas de uso turístico autonómicos.

| Fuente                                                                                | Titular / autor                                            | Enlace                                                                                                                                                   | Licencia                                                                                                                          |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| OpenRTA — Registro de Turismo de Andalucía (viviendas de uso turístico)               | Junta de Andalucía (Registro de Turismo de Andalucía, RTA) | [API OpenRTA](https://datos.juntadeandalucia.es/api/v0/openrta/search) · [Catálogo en datos.gob.es](https://datos.gob.es/es/catalogo/a01002820-openrta)  | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                                                                         |
| Registre de Turisme de Catalunya — establiments d'allotjament turístic                | Generalitat de Catalunya (Departament d'Empresa i Treball) | [Dataset Socrata t2h3-cgys](https://analisi.transparenciacatalunya.cat/d/t2h3-cgys)                                                                      | [Llicència oberta d'ús d'informació – Catalunya](https://web.gencat.cat/ca/generalitat/dades-indicadors/dades-obertes/llicencies) |
| Viviendas de uso turístico de la ciudad de Barcelona (coordenadas)                    | Ajuntament de Barcelona (Open Data BCN)                    | [Dataset](https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatges-us-turistic)                                                              | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                                                                         |
| Registre de Turisme de la Comunitat Valenciana — viviendas de uso turístico           | Generalitat Valenciana                                     | [Dataset diario](https://dadesobertes.gva.es/es/dataset/758f8f8e-c5af-4622-b268-a6c591710a51)                                                            | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                                                                         |
| Coordenadas por referencia catastral (Consulta_CPMRC)                                 | Dirección General del Catastro                             | [Sede Electrónica del Catastro](https://www.sedecatastro.gob.es/)                                                                                        | [Condiciones de acceso](https://www.catastro.hacienda.gob.es/esp/condiciones_acceso.asp)                                          |
| Registre d'Habitatges Turístics i Estades Turístiques en Habitatge de Mallorca        | Consell de Mallorca (Dades Obertes GOIB)                   | [Dataset](https://intranet.caib.es/opendatacataleg/ca/dataset/habitatges-turistics-mallorca)                                                             | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                                                                         |
| Alojamientos inscritos en el Registro de Turismo de Navarra                           | Gobierno de Navarra                                        | [Dataset (CKAN DataStore)](https://datosabiertos.navarra.es/es/dataset/alojamientos-inscritos-en-el-registro-de-turismo-de-navarra)                      | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                                                                         |
| Viviendas y habitaciones de vivienda particular para uso turístico en Euskadi (REATE) | Gobierno Vasco (Open Data Euskadi)                         | [Dataset](https://opendata.euskadi.eus/catalogo/-/viviendas-y-habitaciones-de-vivienda-particular-para-uso-turistico-en-euskadi/)                        | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                                                                         |
| Declaraciones responsables de viviendas de uso turístico                              | Comunidad de Madrid                                        | [Dataset](https://datos.comunidad.madrid/dataset/declaraciones_actividad_viviendas_uso_turistico)                                                        | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                                                                         |
| Registro General Turístico de Canarias — viviendas vacacionales                       | Gobierno de Canarias                                       | [Dataset](https://datos.canarias.es/catalogos/general/dataset/establecimientos-extrahoteleros-de-tipologia-vivienda-vacacional-inscritos-en-el-registro) | [Aviso legal datos.canarias.es (reutilización con atribución)](https://datos.canarias.es/portal/aviso-legal-y-condiciones-de-uso) |
| Listado público de viviendas vacacionales y apartamentos turísticos del ITREM         | Instituto de Turismo de la Región de Murcia (ITREM)        | [Listado](https://www.turismoregiondemurcia.es/es/etudoc.parser/?vtip=6&documento=xls)                                                                   | [Reutilización de información del sector público (Ley 37/2007)](https://www.boe.es/buscar/act.php?id=BOE-A-2007-19814)            |
| Registre d'estades i habitatges turístics vacacionals de Menorca                      | Consell Insular de Menorca (Dades Obertes GOIB)            | [Dataset](https://intranet.caib.es/opendatacataleg/ca/dataset/estades-i-habitatges-turistics-vacacionals-de-menorca)                                     | [CC BY](https://creativecommons.org/licenses/by/4.0/)                                                                             |
| Directorio de alojamientos del REAT (Galicia)                                         | Xunta de Galicia (Turismo de Galicia)                      | [Dataset](https://abertos.xunta.gal/catalogo/cultura-ocio-deporte/-/dataset/0401/directorio-alojamientos-turisticos)                                     | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.es)                                                            |
| Registro de Turismo de Castilla y León                                                | Junta de Castilla y León                                   | [Dataset](https://analisis.datosabiertos.jcyl.es/explore/dataset/registro-de-turismo-de-castilla-y-leon/)                                                | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                                                                         |
| Listado público de VUT del Registro de Turismo de Aragón                              | Gobierno de Aragón                                         | [Export XLSX](https://aplicaciones.aragon.es/wturpub/informes/exportarActividadesTuristicasExcel?tipoExportacion=exportarVUT)                            | [Reutilización de información del sector público (Ley 37/2007)](https://www.boe.es/buscar/act.php?id=BOE-A-2007-19814)            |
| Apartamentos turísticos y viviendas de uso turístico de Castilla-La Mancha            | Junta de Comunidades de Castilla-La Mancha                 | [Dataset](https://datosabiertos.castillalamancha.es/dataset/apartamentos-tur%C3%ADsticos-y-viviendas-de-uso-tur%C3%ADstico-en-castilla-la-mancha)        | [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/deed.es)                                                                |
| Listado de apartamentos turísticos de Extremadura                                     | Junta de Extremadura                                       | [CSV](https://www.juntaex.es/documents/77055/5801338/AptosTuristicos.csv)                                                                                | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                                                                         |
| Portal de Registres Turístics d'Eivissa (habitatges turístics)                        | Consell Insular d'Eivissa                                  | [Buscador y export](https://registreturistic.conselldeivissa.es/habitatges-turistics/)                                                                   | [Reutilización de información del sector público (Ley 37/2007)](https://www.boe.es/buscar/act.php?id=BOE-A-2007-19814)            |
| Viviendas Turísticas — servicio INSPIRE de la DG de Turismo de Cantabria              | Gobierno de Cantabria                                      | [Servicio ArcGIS REST (capa 3)](https://geoservicios.cantabria.es/inspire/rest/services/Turismo_Infraestructura_Turistica/MapServer)                     | Licencia de Uso No Comercial (Decreto 87/2013 de Cantabria)                                                                       |
| Listado de viviendas autorizadas del Registro de Proveedores de Servicios Turísticos  | Gobierno de La Rioja                                       | [Trámite con el listado (PDF mensual)](https://web.larioja.org/oficina-electronica/tramite?n=24269)                                                      | [Reutilización (Ley 37/2007; Decreto 19/2013)](https://www.boe.es/buscar/act.php?id=BOE-A-2007-19814)                             |
| Visor de viviendas de uso turístico con licencia (Gijón)                              | Ayuntamiento de Gijón (Urbanismo)                          | [Visor de VUT](https://documentos.gijon.es/doc/Urbanismo/PGO/Interactivo_vuts/)                                                                          | [Reutilización de información del sector público (Ley 37/2007)](https://www.boe.es/buscar/act.php?id=BOE-A-2007-19814)            |
| Alojamientos turísticos — extracto municipal del REAT (Avilés)                        | Ayuntamiento de Avilés                                     | [Dataset CKAN](https://datos.gob.es/es/catalogo/l01330045-alojamientos-turisticos1)                                                                      | [CC BY](https://creativecommons.org/licenses/by/4.0/)                                                                             |
| Geocodificación por dirección (CartoCiudad)                                           | Instituto Geográfico Nacional (IGN)                        | [CartoCiudad](https://www.cartociudad.es/)                                                                                                               | Servicio público gratuito del IGN                                                                                                 |

**Atribución (CC BY 4.0):** «OpenRTA — Registro de Turismo de Andalucía» de la [Junta de Andalucía](https://datos.gob.es/es/catalogo/a01002820-openrta), disponible en el [portal de datos abiertos de la Junta de Andalucía](https://datos.juntadeandalucia.es/api/v0/openrta/search), bajo licencia [Creative Commons Reconocimiento 4.0 Internacional (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). «Viviendas de uso turístico de la ciudad de Barcelona» del [Ajuntament de Barcelona](https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatges-us-turistic), bajo CC BY 4.0. «Lista de viviendas turísticas» (Registre de Turisme de la Comunitat Valenciana) de la [Generalitat Valenciana](https://dadesobertes.gva.es/es/dataset/758f8f8e-c5af-4622-b268-a6c591710a51), bajo CC BY 4.0; coordenadas obtenidas de la Dirección General del Catastro (Sede Electrónica del Catastro). «Registre d'Habitatges Turístics i Estades Turístiques en Habitatge de Mallorca» del [Consell de Mallorca](https://intranet.caib.es/opendatacataleg/ca/dataset/habitatges-turistics-mallorca), bajo CC BY 4.0. «Alojamientos inscritos en el Registro de Turismo de Navarra» del [Gobierno de Navarra](https://datosabiertos.navarra.es/es/dataset/alojamientos-inscritos-en-el-registro-de-turismo-de-navarra), bajo CC BY 4.0. «Viviendas y habitaciones de vivienda particular para uso turístico en Euskadi» del [Gobierno Vasco](https://opendata.euskadi.eus/catalogo/-/viviendas-y-habitaciones-de-vivienda-particular-para-uso-turistico-en-euskadi/), bajo CC BY 4.0; parte de las coordenadas se resuelven con el geocodificador CartoCiudad del IGN. «Declaraciones responsables de actividad de viviendas de uso turístico» de la [Comunidad de Madrid](https://datos.comunidad.madrid/dataset/declaraciones_actividad_viviendas_uso_turistico), bajo CC BY 4.0 (instantánea aproximadamente mensual del listado vigente de declaraciones). «Registro de Turismo de Castilla y León» de la [Junta de Castilla y León](https://analisis.datosabiertos.jcyl.es/explore/dataset/registro-de-turismo-de-castilla-y-leon/), bajo CC BY 4.0. «Listado de apartamentos turísticos» de la [Junta de Extremadura](https://www.juntaex.es/documents/77055/5801338/AptosTuristicos.csv), bajo CC BY 4.0. «Estades i habitatges turístics vacacionals de Menorca» del [Consell Insular de Menorca](https://intranet.caib.es/opendatacataleg/ca/dataset/estades-i-habitatges-turistics-vacacionals-de-menorca) (Dades Obertes GOIB), bajo CC BY.

**Atribución (CC BY-SA):** «Directorio de alojamientos del REAT» de la [Xunta de Galicia](https://abertos.xunta.gal/catalogo/cultura-ocio-deporte/-/dataset/0401/directorio-alojamientos-turisticos), bajo CC BY-SA 4.0. «Apartamentos turísticos y viviendas de uso turístico en Castilla-La Mancha» de la [Junta de Comunidades de Castilla-La Mancha](https://datosabiertos.castillalamancha.es/dataset/apartamentos-tur%C3%ADsticos-y-viviendas-de-uso-tur%C3%ADstico-en-castilla-la-mancha), bajo CC BY-SA.

**Atribución (otras condiciones):** «Establecimientos extrahoteleros de tipología vivienda vacacional» del [Gobierno de Canarias](https://datos.canarias.es/catalogos/general/dataset/establecimientos-extrahoteleros-de-tipologia-vivienda-vacacional-inscritos-en-el-registro), reutilización con atribución según su [aviso legal](https://datos.canarias.es/portal/aviso-legal-y-condiciones-de-uso). Listados públicos de viviendas vacacionales y apartamentos turísticos del [ITREM (Región de Murcia)](https://www.turismoregiondemurcia.es/es/etudoc.parser/?vtip=6&documento=xls), [export de VUT del Registro de Turismo de Aragón](https://aplicaciones.aragon.es/wturpub/informes/exportarActividadesTuristicasExcel?tipoExportacion=exportarVUT), [export de habitatges turístics del Consell Insular d'Eivissa](https://registreturistic.conselldeivissa.es/habitatges-turistics/), [listado de viviendas autorizadas del Gobierno de La Rioja](https://web.larioja.org/oficina-electronica/tramite?n=24269) (Ley 37/2007 y Decreto 19/2013 riojano) y [visor de VUT con licencia del Ayuntamiento de Gijón](https://documentos.gijon.es/doc/Urbanismo/PGO/Interactivo_vuts/): reutilización de información del sector público (Ley 37/2007), sin licencia abierta explícita. «Viviendas Turísticas» del [servicio INSPIRE del Gobierno de Cantabria](https://geoservicios.cantabria.es/inspire/rest/services/Turismo_Infraestructura_Turistica/MapServer), bajo la Licencia de Uso No Comercial del Decreto 87/2013 de Cantabria. «Alojamientos turísticos» del [Ayuntamiento de Avilés](https://datos.gob.es/es/catalogo/l01330045-alojamientos-turisticos1), bajo CC BY; sus coordenadas y las de Eivissa se resuelven en la Dirección General del Catastro.

**Atribución (llicència oberta – Catalunya):** «Establiments d'allotjament turístic inscrits al Registre de Turisme de Catalunya», Generalitat de Catalunya. Departament d'Empresa i Treball, con indicación de la fecha de la última sincronización semanal.

**Modificaciones realizadas por Viviendas Perdidas** (obligatorio indicarlas según las licencias):

- se filtran los registros a viviendas de uso turístico: en Andalucía las marcadas como publicadas en el RTA abierto (`ind_pub_open_rta = 'S'`); en Cataluña los tipos «Habitatges d'ús turístic» y «Llars compartides» en estado de alta; en la Comunitat Valenciana todas las filas del listado diario de los municipios espejados; en Mallorca los grupos ETV/ETVPL/ETV60 y habitatge turístic de vacances en alta (se excluyen comercializadores y empresarios, que son operadores y no viviendas); en Navarra las modalidades de apartamento turístico y vivienda turística; en Euskadi los dos ficheros del REATE (viviendas completas y habitaciones; las habitaciones suman habitantes, nunca hogares); en Madrid las declaraciones responsables VT vigentes del municipio de Madrid, con identidad sintética por dirección normalizada (el conjunto no publica número de registro ni plazas); en Canarias las viviendas vacacionales del Registro General Turístico (descartando las coordenadas rellenas con (0,0), que se geocodifican aparte); en la Región de Murcia las viviendas vacacionales (VV.MU.\*) y los apartamentos turísticos (A.MU.\*, una fila por apartamento) del listado del ITREM, descartando el teléfono y el email del titular; en Menorca las estancias y viviendas turísticas de vacaciones (derivando una clave con la dirección cuando el número de registro se repite, y descartando el teléfono); en Galicia las viviendas de uso turístico, las viviendas turísticas y los complejos de «APARTAMENTOS» del directorio REAT (descartando teléfono y correo); en Castilla y León las figuras «Vivienda turística» y «Apartamentos Turísticos» del registro (validando formato y rango de coordenadas y descartando los datos de contacto); en Aragón las VUT del export del buscador público (descartando el contacto personal del titular); en Castilla-La Mancha los subepígrafes V.U.T., apartamento turístico y vivienda vacacional, con clave sintética por falta de número de registro (descartando email y teléfono); en Extremadura los apartamentos turísticos, con clave sintética y reconstruyendo el cero inicial de los códigos postales pacenses; en Ibiza las cuatro figuras de vivienda del export insular (ETV/ET/VTV/VT, descartando el titular con su NIF, el teléfono y el email); en Cantabria las modalidades de alquiler completo y compartido de la capa de la DG de Turismo, con clave sintética por dirección (la capa no publica el número de registro) y descartando teléfono, email y web; en La Rioja las VUT del listado mensual (VT-LR-\*); en Gijón las VUT con licencia del visor municipal (descartando el interesado y los enlaces internos); en Avilés las signaturas VUT./VV./AT. vigentes del extracto municipal del REAT (descartando el titular);
- las coordenadas andaluzas se reproyectan de UTM (ETRS89 / UTM zona 30N, EPSG:25830) a WGS84 (latitud/longitud) mediante `proj4`; a los registros barceloneses, que el registro autonómico publica sin coordenadas ni (en su mayoría) plazas, se les asignan ambas del dataset municipal del Ajuntament cruzando por número de registro; a los valencianos se les asignan las coordenadas del centroide de su parcela resolviendo la referencia catastral publicada contra el servicio `Consulta_CPMRC` del Catastro (resultado cacheado en `officialGeoCache` bajo `catastro-*`);
- se normalizan códigos de licencia, direcciones y nombres de calle para el cruce con los registros vecinales;
- se calculan estadísticas agregadas por municipio (total, viviendas completas, solo por habitaciones, plazas); en las «por habitaciones» / «llars compartides» se estima un habitante desplazado por habitación (habitaciones ≈ plazas ÷ 2, mínimo 1), sin contarlas como hogar desplazado;
- los edificios de apartamentos turísticos cuentan por sus viviendas, no como una: con el dato exacto donde el registro lo publica (unidades de alojamiento en Andalucía y Extremadura) o inscribe cada apartamento por separado (Región de Murcia), y estimando el número de apartamentos con un ratio de ~3,5 plazas por apartamento donde solo se publica la capacidad (Cataluña, Castilla y León, Galicia, Navarra, Avilés);
- se agrupan las viviendas geolocalizadas en celdas geohash de varias precisiones (colecciones `officialCells` y `officialCellPins`) para dibujar burbujas por nivel de zoom y contar lo visible en el mapa; los registros sin coordenadas no pueden dibujarse ni contarse;
- se descartan las coordenadas de origen manifiestamente erróneas (a más de unas decenas de km del municipio del propio registro) y se reparan geocodificando la dirección publicada (Google Geocoding, resultado cacheado en `officialGeoCache`); si la geocodificación no alcanza precisión de calle, el registro queda sin ubicación en el mapa;
- solo se mantiene un subconjunto de municipios (ver las listas `SYNCED_*` de las quince fuentes en `functions/src/services/official-sync.ts`).

**Sincronización:** los veinte trabajos programados semanales — `syncOpenRta` (lunes 04:30 Europe/Madrid), `syncLaRioja` (lunes 05:30), `syncMurcia` (lunes 06:30), `syncCatalunya` (martes 04:30), `syncEivissa` (martes 05:30), `syncMenorca` (martes 06:30), `syncValencia` (miércoles 04:30), `syncAviles` (miércoles 05:30), `syncGalicia` (miércoles 06:30), `syncMallorca` (jueves 04:30), `syncGijon` (jueves 05:30), `syncCastillaLeon` (jueves 06:30), `syncNavarra` (viernes 04:30), `syncCanarias` (viernes 05:30), `syncCantabria` (viernes 06:30), `syncEuskadi` (sábado 04:30), `syncAragon` (sábado 06:30), `syncMadrid` (domingo 04:30), `syncCastillaLaMancha` (domingo 06:30) y `syncExtremadura` (domingo 07:30) —, todos en `europe-west1` porque Cloud Scheduler no opera en `europe-southwest1`, y el callable `adminSyncOfficialData` reconstruyen las colecciones `officialVut`, `officialStats`, `officialCells` y `officialCellPins` de forma diferencial (las celdas obsoletas se eliminan en cada pasada y la purga de bajas está acotada por fuente). Descargas iniciales: julio de 2026 (~50.900 viviendas en 10 municipios andaluces; ~10.700 en Barcelona; ~14.500 en València, Alicante y Benidorm; ~630 en Palma; ~470 en Pamplona; ~2.650 en Donostia y Bilbao; ~1.200 declaraciones vigentes en Madrid); el resto de registros se incorporó entre julio y agosto de 2026.

**Sin respaldo oficial:** ninguna administración citada (Junta de Andalucía, Generalitat de Catalunya, Ajuntament de Barcelona, Generalitat Valenciana, Dirección General del Catastro, Consell de Mallorca, Gobierno de Navarra, Gobierno Vasco, Comunidad de Madrid, Gobierno de Canarias, Instituto de Turismo de la Región de Murcia, Consell Insular de Menorca, Xunta de Galicia, Junta de Castilla y León, Gobierno de Aragón, Junta de Comunidades de Castilla-La Mancha, Junta de Extremadura, Consell Insular d'Eivissa, Gobierno de Cantabria, Gobierno de La Rioja, Ayuntamiento de Gijón, Ayuntamiento de Avilés, IGN) respalda, patrocina o avala Viviendas Perdidas. La cita de las fuentes es un crédito neutral y no implica relación, colaboración ni aprobación por parte de los titulares de los datos. Los datos oficiales se ofrecen «tal cual» y «según disponibilidad», sin garantías.

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

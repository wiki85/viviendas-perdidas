import { escapeHtml } from './html.js';
import { pageShell } from './render-city.js';

/**
 * /fuentes — the transparency page: every autonomous-community source the
 * map synchronizes, what it serves, how we geolocate it, what broke, what
 * the administration could improve, and a 0-100 score under a rubric shared
 * by all sources.
 *
 * OBLIGACIÓN DE MANTENIMIENTO: si una fuente cambia (URL, esquema, cadencia,
 * licencia) o se integra una comunidad nueva, esta página DEBE actualizarse
 * en el mismo cambio. El aviso equivalente vive junto a getSyncConfig() en
 * services/official-sync.ts.
 */

/** Máximos por criterio de la rúbrica común (suman 100). */
export const RUBRIC = [
  {
    key: 'ubicacion',
    label: 'Ubicación de las viviendas',
    max: 25,
    detail:
      'Coordenadas publicadas por la propia fuente (25) o referencia catastral resoluble (20); parciales puntúan proporcionalmente; solo dirección postal, casi nada.',
  },
  {
    key: 'identificador',
    label: 'Identificador registral estable',
    max: 15,
    detail:
      'Número de registro oficial único y persistente que permite seguir cada vivienda entre sincronizaciones sin inventar claves.',
  },
  {
    key: 'riqueza',
    label: 'Riqueza de los datos',
    max: 20,
    detail:
      'Plazas/capacidad, modalidad separable (vivienda completa vs habitaciones), dirección completa.',
  },
  {
    key: 'frecuencia',
    label: 'Frecuencia de actualización',
    max: 20,
    detail: 'Diaria o continua (20), semanal (15), mensual (10), semestral (5), estancada (0).',
  },
  {
    key: 'acceso',
    label: 'Acceso técnico',
    max: 10,
    detail:
      'Descarga o API estable y documentada en un portal de datos abiertos, sin sesiones ni trucos.',
  },
  {
    key: 'licencia',
    label: 'Licencia de reutilización',
    max: 10,
    detail: 'Licencia abierta explícita (CC BY o equivalente) frente a avisos legales ambiguos.',
  },
] as const;

type ScoreKey = (typeof RUBRIC)[number]['key'];

export interface SourceEntry {
  id: string;
  ccaa: string;
  registro: string;
  cities: string;
  links: Array<{ label: string; url: string }>;
  datos: string[];
  posicionamiento: string;
  problemas: string[];
  mejoras: string[];
  frecuencia: string;
  licencia: string;
  score: Record<ScoreKey, number>;
}

export const SOURCES: SourceEntry[] = [
  {
    id: 'rta',
    ccaa: 'Andalucía',
    registro: 'Registro de Turismo de Andalucía (RTA) — Junta de Andalucía',
    cities: 'Sevilla, Málaga, Granada, Córdoba, Cádiz, Huelva, Jaén, Almería, Jerez y Marbella',
    links: [
      {
        label: 'Dataset OpenRTA (datos.gob.es)',
        url: 'https://datos.gob.es/es/catalogo/a01002820-openrta',
      },
    ],
    datos: [
      'Número de registro estable, modalidad (vivienda completa o por habitaciones), plazas, dirección postal completa y coordenadas para la mayoría de altas.',
      'Desde agosto de 2026 espejamos también los «apartamentos turísticos» (los edificios y conjuntos de la placa azul AT). El registro declara el número real de apartamentos de cada edificio (campo de unidades de alojamiento), así que un edificio de 54 pisos cuenta como 54 viviendas perdidas, no como una.',
    ],
    posicionamiento:
      'La mayoría de viviendas llegan con coordenadas de la propia Junta (validadas contra un radio municipal de plausibilidad); los huecos se resuelven con CartoCiudad (IGN) y, como último recurso, geocodificación comercial.',
    problemas: [
      'GRAVE: OpenRTA solo publica los establecimientos con consentimiento de publicación. La figura de apartamentos turísticos apenas aparece (28 en toda Sevilla, 32 en Málaga, 5 en Granada) pese a que las calles están llenas de placas AT: hemos verificado edificios enteros inscritos y con placa oficial (Alameda de Hércules 91 y 97, Jesús del Gran Poder 100, en Sevilla) que no existen en el dato abierto en NINGUNA figura. Los edificios completos convertidos en alojamiento — lo más lesivo para la vivienda — son justo lo que menos se publica.',
      'Un pequeño porcentaje de coordenadas cae fuera del municipio declarado y hay que descartarlas y re-geocodificarlas.',
      'El volcado completo es pesado y ocasionalmente devuelve errores transitorios que obligan a reintentar.',
    ],
    mejoras: [
      'Publicar TODOS los establecimientos inscritos, no solo los que consienten aparecer: un registro público que oculta parte de sus asientos no cumple su función de transparencia.',
      'Publicar la referencia catastral junto a cada alta cerraría el hueco de coordenadas sin coste.',
      'Documentar un campo de fecha de última modificación por registro facilitaría sincronizaciones incrementales.',
    ],
    frecuencia: 'Continua (el registro se consulta en vivo); nosotros sincronizamos cada lunes.',
    licencia: 'CC BY 4.0',
    // riqueza rebajada de 17 a 15 (10 ago 2026) al verificar que la figura
    // de apartamentos turísticos apenas se publica.
    score: {
      ubicacion: 20,
      identificador: 15,
      riqueza: 15,
      frecuencia: 20,
      acceso: 9,
      licencia: 10,
    },
  },
  {
    id: 'gva',
    ccaa: 'Comunidad Valenciana',
    registro: 'Registro de Turismo de la Comunidad Valenciana — Generalitat Valenciana',
    cities: 'Valencia, Alicante, Benidorm, Torrevieja, Calpe y Denia',
    links: [
      {
        label: 'Dataset diario (dadesobertes.gva.es)',
        url: 'https://dadesobertes.gva.es/es/dataset/758f8f8e-c5af-4622-b268-a6c591710a51',
      },
    ],
    datos: [
      'Número de registro, dirección, código postal, municipio (código INE), dormitorios, plazas y — la joya — referencia catastral en el ~99% de filas. La figura valenciana siempre cede la vivienda completa.',
    ],
    posicionamiento:
      'Resolvemos la referencia catastral contra la Sede del Catastro (centroide de parcela), que da ubicación a nivel de portal sin coste; el resto va a CartoCiudad y geocodificación comercial.',
    problemas: [
      'El registro no publica coordenadas directamente: dependemos del Catastro, con un presupuesto de consultas por sincronización que hace que los municipios grandes tarden varias pasadas en quedar completos.',
      'El endpoint JSON moderno del Catastro falla sistemáticamente; hay que usar el servicio XML clásico.',
    ],
    mejoras: [
      'Incluir las coordenadas ya resueltas en el propio CSV diario ahorraría miles de consultas al Catastro a todos los reutilizadores.',
    ],
    frecuencia: 'Volcado diario; nosotros sincronizamos cada miércoles.',
    licencia: 'CC BY 4.0',
    score: {
      ubicacion: 20,
      identificador: 15,
      riqueza: 16,
      frecuencia: 20,
      acceso: 9,
      licencia: 10,
    },
  },
  {
    id: 'cat',
    ccaa: 'Cataluña',
    registro: 'Registro de Turismo de Cataluña (RTC) — Generalitat de Catalunya',
    cities: 'Barcelona, Girona y Tarragona',
    links: [
      {
        label: 'Dataset Socrata (analisi.transparenciacatalunya.cat)',
        url: 'https://analisi.transparenciacatalunya.cat/d/t2h3-cgys',
      },
      {
        label: 'Coordenadas del Ajuntament de Barcelona (Open Data BCN)',
        url: 'https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatges-us-turistic',
      },
    ],
    datos: [
      'Número de inscripción estable, modalidad separable (vivienda de uso turístico, hogar compartido y apartamentos turísticos), dirección con piso y puerta y código postal. La capacidad (plazas) solo consta en una minoría de filas (~24%) y, desde 2026, hay referencia catastral en torno a una de cada cinco altas.',
    ],
    posicionamiento:
      'En Barcelona cruzamos por número de registro con el dataset municipal del Ajuntament, que sí publica coordenadas (prácticamente el 100% ubicado). En Girona y Tarragona el registro no trae coordenadas y geocodificamos por dirección con CartoCiudad y geocodificación comercial en varias pasadas.',
    problemas: [
      'El registro autonómico no publica coordenadas, y la referencia catastral que empezó a asomar en 2026 solo cubre en torno al 19% de las altas: fuera de Barcelona casi toda la ubicación corre de nuestra cuenta.',
      'La mayoría de las altas no declara la capacidad (plazas), pese a ser un dato del registro.',
      'El dataset ha pasado de actualizarse a diario a declararse mensual (última actualización de datos: 31 de julio de 2026).',
      'El dataset municipal de coordenadas de Barcelona declara frecuencia semanal, pero lleva desde mayo de 2026 sin regenerarse: las altas posteriores pueden quedar sin ubicar hasta que se refresque.',
    ],
    mejoras: [
      'Publicar coordenadas o completar la referencia catastral para toda Cataluña, como ya hace el Ajuntament de Barcelona con su término municipal.',
      'Completar el campo de plazas en todas las altas.',
      'Recuperar la cadencia diaria de actualización que el dataset tenía.',
    ],
    frecuencia:
      'El portal declara ahora frecuencia mensual (antes diaria); nosotros sincronizamos cada martes.',
    licencia:
      'Licencia abierta de uso de información – Cataluña (equivalente a CC BY); coordenadas municipales CC BY 4.0.',
    // frecuencia rebajada de 20 a 10 (24 ago 2026): el portal declara cadencia
    // mensual y la última actualización de datos fue el 31 de julio de 2026.
    score: {
      ubicacion: 10,
      identificador: 15,
      riqueza: 16,
      frecuencia: 10,
      acceso: 9,
      licencia: 9,
    },
  },
  {
    id: 'caib',
    ccaa: 'Islas Baleares (Mallorca)',
    registro: 'Registro insular de viviendas turísticas de Mallorca — Consell de Mallorca',
    cities: 'Palma, Calvià y Alcudia',
    links: [
      {
        label: 'GeoJSON del catálogo CAIB',
        url: 'https://intranet.caib.es/opendatacataleg/ca/dataset/habitatges-turistics-mallorca',
      },
    ],
    datos: [
      'Número de registro, grupo de alta (ETV/ETVPL/ETV60/vivienda turística — siempre vivienda completa), dirección, municipio, plazas y coordenadas WGS84 en aproximadamente la mitad de las fichas.',
    ],
    posicionamiento:
      'Usamos las coordenadas del propio registre cuando existen y son plausibles; la otra mitad se geocodifica por dirección (CartoCiudad y geocodificación comercial).',
    problemas: [
      'Solo la mitad de las fichas traen geometría; el resto depende de direcciones a veces incompletas.',
      'El mismo catálogo mezcla operadores comerciales («comercialitzadors») con viviendas: hay que filtrar por grupo para no inflar el recuento.',
      'El catálogo declara refresco diario automático, pero el fichero pasa temporadas sin regenerarse (más de dos semanas observadas en agosto de 2026).',
    ],
    mejoras: [
      'Georreferenciar el 100% de las fichas (el propio Consell ya lo hace con la mitad).',
      'Separar en datasets distintos las viviendas de los operadores comerciales.',
      'Cumplir el refresco diario que el catálogo declara.',
    ],
    frecuencia:
      'Declarado diario y automático, aunque con temporadas sin regenerarse; nosotros sincronizamos cada jueves.',
    licencia: 'CC BY (el portal no declara versión)',
    score: {
      ubicacion: 14,
      identificador: 15,
      riqueza: 15,
      frecuencia: 15,
      acceso: 8,
      licencia: 10,
    },
  },
  {
    id: 'nav',
    ccaa: 'Navarra',
    registro: 'Registro de Turismo de Navarra — Gobierno de Navarra',
    cities: 'Pamplona',
    links: [
      {
        label: 'Dataset CKAN (datosabiertos.navarra.es)',
        url: 'https://datosabiertos.navarra.es/es/dataset/alojamientos-inscritos-en-el-registro-de-turismo-de-navarra',
      },
    ],
    datos: [
      'Número de registro, modalidad separable (apartamento turístico, vivienda turística, bloques de apartamentos turísticos y variantes rurales), dirección, municipio y plazas.',
    ],
    posicionamiento:
      'El dataset no publica coordenadas: geocodificamos cada dirección con CartoCiudad (IGN) y verificación de municipio, con geocodificación comercial de respaldo.',
    problemas: [
      'Sin coordenadas ni referencia catastral: toda la ubicación es trabajo del reutilizador.',
      'El dataset mezcla todos los tipos de alojamiento y hay que filtrar las modalidades de vivienda.',
    ],
    mejoras: ['Añadir coordenadas o referencia catastral a cada alta del registro.'],
    frecuencia: 'Actualización diaria vía API CKAN; nosotros sincronizamos cada viernes.',
    licencia: 'CC BY 4.0',
    score: {
      ubicacion: 5,
      identificador: 15,
      riqueza: 15,
      frecuencia: 20,
      acceso: 9,
      licencia: 10,
    },
  },
  {
    id: 'eus',
    ccaa: 'Euskadi',
    registro: 'Registro de Empresas y Actividades Turísticas de Euskadi (REATE) — Gobierno Vasco',
    cities: 'Donostia / San Sebastián y Bilbao',
    links: [
      {
        label: 'Dataset de viviendas y habitaciones (Open Data Euskadi)',
        url: 'https://opendata.euskadi.eus/catalogo/-/viviendas-y-habitaciones-de-vivienda-particular-para-uso-turistico-en-euskadi/',
      },
    ],
    datos: [
      'Número de registro, capacidad, dirección, código de municipio, y — modelado ejemplar — dos ficheros separados para viviendas completas y para habitaciones en vivienda particular, con número de habitaciones.',
    ],
    posicionamiento:
      'Sin coordenadas en origen: geocodificamos por dirección con CartoCiudad y respaldo comercial. Bilbao y Donostia están hoy al 99-100% tras varias pasadas.',
    problemas: [
      'Sin coordenadas ni referencia catastral.',
      'Existe un dataset hermano de «alojamientos turísticos» con coordenadas que NO incluye las viviendas de uso turístico — una trampa clásica para reutilizadores.',
    ],
    mejoras: [
      'Incorporar las VUT al dataset georreferenciado de alojamientos, o añadir coordenadas al dataset específico.',
    ],
    frecuencia:
      'El portal declara actualización diaria, pero el fichero cambia aproximadamente cada semana (observado); nosotros sincronizamos cada sábado.',
    licencia: 'CC BY 4.0',
    // frecuencia ajustada de 13 a 15 (24 ago 2026): el refresco real observado
    // es semanal, el tramo «semanal» de la rúbrica.
    score: {
      ubicacion: 5,
      identificador: 15,
      riqueza: 17,
      frecuencia: 15,
      acceso: 8,
      licencia: 10,
    },
  },
  {
    id: 'mad',
    ccaa: 'Comunidad de Madrid',
    registro: 'Declaraciones responsables de viviendas de uso turístico — Comunidad de Madrid',
    cities: 'Madrid',
    links: [
      {
        label: 'Dataset (datos.comunidad.madrid)',
        url: 'https://datos.comunidad.madrid/dataset/declaraciones_actividad_viviendas_uso_turistico',
      },
    ],
    datos: [
      'Únicamente tipo de alojamiento, vía, número y localidad. Sin número de registro, sin plazas, sin coordenadas, sin referencia catastral.',
    ],
    posicionamiento:
      'Construimos un identificador sintético a partir de la dirección normalizada y geocodificamos todo: primero CartoCiudad (IGN) con verificación de municipio y después geocodificación comercial. Madrid está hoy al 100% ubicado, con precisión de portal.',
    problemas: [
      'El CSV es una instantánea del listado vigente que se sobreescribe: sin identificador estable, cualquier corrección de dirección parece un alta más una baja.',
      'Codificación de texto inconsistente entre ficheros (mezcla de UTF-8 y Latin-1) y dos esquemas de columnas distintos según el mes.',
      'Sin plazas, es imposible estimar la capacidad turística real de la ciudad desde la fuente oficial.',
    ],
    mejoras: [
      'Publicar el número de expediente o registro de cada declaración (existe en el procedimiento administrativo).',
      'Añadir plazas, coordenadas o referencia catastral.',
      'Mantener un histórico acumulado en lugar de sobreescribir la instantánea mensual.',
    ],
    frecuencia:
      'Instantánea del listado vigente con refresco aproximadamente mensual; nosotros sincronizamos cada domingo.',
    licencia: 'CC BY 4.0',
    score: { ubicacion: 4, identificador: 0, riqueza: 5, frecuencia: 10, acceso: 8, licencia: 10 },
  },
  {
    id: 'can',
    ccaa: 'Canarias',
    registro:
      'Registro General Turístico de Canarias (viviendas vacacionales) — Gobierno de Canarias',
    cities:
      'Las Palmas de Gran Canaria, Santa Cruz de Tenerife, Arona, Adeje, San Bartolomé de Tirajana, Mogán, La Oliva, Yaiza y Tías',
    links: [
      {
        label: 'Dataset de viviendas vacacionales (datos.canarias.es)',
        url: 'https://datos.canarias.es/catalogos/general/dataset/establecimientos-extrahoteleros-de-tipologia-vivienda-vacacional-inscritos-en-el-registro',
      },
    ],
    datos: [
      'Número de registro estable, nombre comercial, dirección, municipio, código postal, dormitorios, plazas y coordenadas WGS84 en el ~70% de las fichas (el resto viene relleno con el punto (0,0)). Toda vivienda vacacional canaria es la vivienda completa.',
    ],
    posicionamiento:
      'Usamos directamente las coordenadas publicadas por el Gobierno de Canarias, validadas contra un radio municipal de plausibilidad; el ~30% de fichas que llega con el punto (0,0) se geocodifica por dirección con CartoCiudad (IGN) y respaldo comercial en pasadas sucesivas.',
    problemas: [
      'Unas decenas de números de registro aparecen duplicados en el volcado (nos quedamos con la última aparición).',
      'Cerca de un 30% de las fichas trae las coordenadas rellenas con (0,0) en lugar de vacías: hay que descartarlas y geocodificarlas.',
      'El marcador «_U» (no consta) afecta a un puñado de direcciones y plazas.',
      'Algunas grafías de municipio son inconsistentes («Santa Cruz Tenerife» sin «De», «San Bartolome» sin tilde).',
    ],
    mejoras: [
      'Publicar las coordenadas reales del ~30% de fichas que hoy sale con (0,0).',
      'Depurar los números de registro duplicados y normalizar las grafías de municipio.',
      'Publicar el dataset bajo una licencia estándar (CC BY 4.0) en lugar del aviso legal propio.',
    ],
    frecuencia: 'Refresco diario del volcado; nosotros sincronizamos cada viernes.',
    licencia: 'Aviso legal del Gobierno de Canarias (reutilización con atribución).',
    score: {
      ubicacion: 18,
      identificador: 15,
      riqueza: 16,
      frecuencia: 20,
      acceso: 9,
      licencia: 7,
    },
  },
  {
    id: 'mur',
    ccaa: 'Región de Murcia',
    registro:
      'Registro de empresas y actividades turísticas — Instituto de Turismo de la Región de Murcia (ITREM)',
    cities:
      'Cartagena, San Javier, Torre Pacheco, Murcia, Mazarrón, Los Alcázares, San Pedro del Pinatar y Águilas',
    links: [
      {
        label: 'Listado público de viviendas vacacionales (turismoregiondemurcia.es)',
        url: 'https://www.turismoregiondemurcia.es/es/etudoc.parser/?vtip=6&documento=xls',
      },
    ],
    datos: [
      'Número de registro estable (VV.MU.####), nombre comercial, dirección, localidad con pedanía, código postal, plazas en el 100% de filas y — la joya — referencia catastral en el ~72%. Toda vivienda vacacional murciana se cede completa.',
      'Espejamos también el listado hermano de apartamentos turísticos: el ITREM inscribe cada apartamento como fila propia (signatura A.MU.###-n), así que los edificios completos se cuentan apartamento a apartamento, sin estimar. Ese listado se cae a menudo y lo tratamos como best-effort para que su caída no arrastre a las viviendas.',
    ],
    posicionamiento:
      'Resolvemos la referencia catastral contra la Sede del Catastro (centroide de parcela, precisión de portal, sin coste); el resto se geocodifica por dirección con CartoCiudad (IGN) y respaldo comercial en pasadas sucesivas.',
    problemas: [
      'El «Excel» descargable es en realidad una tabla HTML con extensión .xls en codificación ISO-8859-1, que además sirve alguna cabecera como entidad HTML: hay que parsearla a mano y con cuidado.',
      'El listado publica el teléfono y el email del titular: los descartamos en la ingesta y no se espejan nunca.',
      'El portal de datos abiertos regional lleva sin actualizarse desde 2021; el listado vivo está fuera de él, sin licencia de datos abiertos explícita.',
    ],
    mejoras: [
      'Publicar el listado como CSV en el portal de datos abiertos regional con licencia CC BY.',
      'Completar la referencia catastral del ~28% de altas que no la declara.',
      'Retirar los datos de contacto personales del export público.',
    ],
    frecuencia:
      'Registro en vivo (el export refleja el estado actual); nosotros sincronizamos cada lunes.',
    licencia:
      'Sin licencia explícita: reutilización de información del sector público (Ley 37/2007).',
    score: {
      ubicacion: 14,
      identificador: 15,
      riqueza: 15,
      frecuencia: 20,
      acceso: 4,
      licencia: 4,
    },
  },
  {
    id: 'men',
    ccaa: 'Islas Baleares (Menorca)',
    registro:
      'Registro de estancias y viviendas turísticas de vacaciones de Menorca — Consell Insular de Menorca',
    cities: 'Ciudadela, Mahón, San Luis, Es Mercadal y Alayor',
    links: [
      {
        label: 'GeoJSON del catálogo CAIB',
        url: 'https://intranet.caib.es/opendatacataleg/ca/dataset/estades-i-habitatges-turistics-vacacionals-de-menorca',
      },
    ],
    datos: [
      'Número de registro, tipo (estancias turísticas o vivienda turística de vacaciones — ambas la vivienda completa), nombre, dirección, población, plazas, habitaciones y coordenadas WGS84 en el 100% de los puntos.',
    ],
    posicionamiento:
      'Usamos directamente las coordenadas publicadas por el Consell, validadas contra un radio municipal de plausibilidad: Menorca entra en el mapa completamente ubicada desde la primera sincronización.',
    problemas: [
      'El número de registro se repite entre viviendas de una misma finca: derivamos una clave con la dirección para no perder registros.',
      'Hay valores con espacios finales y el esquema no coincide con el del registro hermano de Mallorca pese a compartir catálogo.',
      'El GeoJSON publica el teléfono del titular: lo descartamos en la ingesta.',
    ],
    mejoras: [
      'Emitir un identificador único por vivienda (registro + sufijo).',
      'Unificar el esquema con el dataset de Mallorca para que los reutilizadores no dupliquen trabajo.',
    ],
    frecuencia: 'Catálogo con refresco periódico; nosotros sincronizamos cada martes.',
    licencia: 'CC BY',
    score: {
      ubicacion: 25,
      identificador: 12,
      riqueza: 16,
      frecuencia: 10,
      acceso: 9,
      licencia: 10,
    },
  },
  {
    id: 'gal',
    ccaa: 'Galicia',
    registro: 'Directorio de alojamientos del REAT — Xunta de Galicia',
    cities: 'Vigo, La Coruña, Santiago de Compostela, Sangenjo y El Grove',
    links: [
      {
        label: 'Dataset del directorio (abertos.xunta.gal)',
        url: 'https://abertos.xunta.gal/catalogo/cultura-ocio-deporte/-/dataset/0401/directorio-alojamientos-turisticos',
      },
    ],
    datos: [
      'Número de registro estable (VUT-CO-003589), denominación, tipo separable (viviendas de uso turístico, viviendas turísticas y complejos de «APARTAMENTOS», estos últimos contados por sus apartamentos estimados por capacidad), habitaciones, plazas en el ~99%, dirección con parroquia y lugar, código postal y municipio.',
    ],
    posicionamiento:
      'El directorio apenas trae coordenadas (unas 200 de 28.000 viviendas): geocodificamos cada dirección con CartoCiudad (IGN) y respaldo comercial en pasadas sucesivas, de modo que el mapa gallego se completa a lo largo de varias semanas.',
    problemas: [
      'Sin coordenadas ni referencia catastral en la práctica: toda la ubicación corre de nuestra cuenta.',
      'El CSV abre con líneas de título antes de la cabecera real, algo que rompe los parsers estándar.',
      'Publica el teléfono y el correo del anuncio: los descartamos en la ingesta.',
      'Las fichas rurales llegan sin calle, solo con parroquia y lugar: la precisión de esas queda a nivel de núcleo.',
    ],
    mejoras: [
      'Añadir coordenadas o referencia catastral a cada alta (el REAT las conoce por el procedimiento).',
      'Servir el CSV con la cabecera en la primera línea.',
    ],
    frecuencia: 'Volcado mensual; nosotros sincronizamos cada miércoles.',
    licencia: 'CC BY-SA 4.0',
    score: {
      ubicacion: 3,
      identificador: 15,
      riqueza: 16,
      frecuencia: 10,
      acceso: 7,
      licencia: 9,
    },
  },
  {
    id: 'cyl',
    ccaa: 'Castilla y León',
    registro: 'Registro de Turismo de Castilla y León — Junta de Castilla y León',
    cities: 'León, Burgos, Salamanca, Valladolid, Zamora, Ávila y Soria',
    links: [
      {
        label: 'Dataset Opendatasoft (analisis.datosabiertos.jcyl.es)',
        url: 'https://analisis.datosabiertos.jcyl.es/explore/dataset/registro-de-turismo-de-castilla-y-leon/',
      },
    ],
    datos: [
      'Número de registro estable (PP/NNNNNN), nombre, dirección, código postal, municipio, plazas y GPS en ~28% de filas. El registro completo mezcla todos los tipos de establecimiento: filtramos «Vivienda turística» y «Apartamentos Turísticos» (los edificios completos, contados por sus apartamentos estimados por capacidad).',
    ],
    posicionamiento:
      'Usamos el GPS del propio registro cuando existe y es plausible (validado contra un radio municipal); el ~72% restante se geocodifica por dirección con CartoCiudad (IGN) y respaldo comercial.',
    problemas: [
      'Algunas coordenadas llegan corruptas (formato «-,0066667»): validamos formato y rango antes de aceptarlas.',
      'Sin referencia catastral.',
      'El dataset publica hasta tres teléfonos y el email del titular: los descartamos en la ingesta.',
    ],
    mejoras: [
      'Georreferenciar el 100% de las altas y depurar las coordenadas corruptas.',
      'Añadir la referencia catastral.',
    ],
    frecuencia: 'Actualización diaria del portal; nosotros sincronizamos cada jueves.',
    licencia: 'CC BY 4.0',
    score: {
      ubicacion: 7,
      identificador: 15,
      riqueza: 15,
      frecuencia: 20,
      acceso: 10,
      licencia: 10,
    },
  },
  {
    id: 'ara',
    ccaa: 'Aragón',
    registro: 'Registro de Turismo de Aragón (buscador público de VUT) — Gobierno de Aragón',
    cities: 'Zaragoza, Jaca, Benasque, Sallent de Gállego (con Formigal), Panticosa y Teruel',
    links: [
      {
        label: 'Export XLSX del buscador público (aplicaciones.aragon.es)',
        url: 'https://aplicaciones.aragon.es/wturpub/informes/exportarActividadesTuristicasExcel?tipoExportacion=exportarVUT',
      },
    ],
    datos: [
      'Número de registro estable (VU-HU-22-100), nombre de la vivienda, dirección, localidad (a nivel de núcleo: Formigal aparece separado de Sallent de Gállego) y código postal. Sin plazas, sin coordenadas y sin referencia catastral.',
    ],
    posicionamiento:
      'Sin ubicación en origen: geocodificamos cada dirección con CartoCiudad (IGN) y respaldo comercial en pasadas sucesivas. La capacidad (plazas) no puede mostrarse porque la fuente no la publica.',
    problemas: [
      'El export no trae plazas: Aragón queda fuera de las métricas de capacidad turística.',
      'Un 4-5% de filas llega sin localidad y con direcciones sin número: quedan sin asignar o con precisión de núcleo.',
      'El portal de datos abiertos autonómico solo publica agregados; el listado real vive en una aplicación sin licencia de datos abiertos.',
      'El servidor rechaza a veces conexiones TLS modernas.',
      'Un 22% de filas publica el teléfono o el email personal del titular: los descartamos en la ingesta.',
    ],
    mejoras: [
      'Publicar el listado (con plazas y coordenadas) como dataset con licencia abierta en opendata.aragon.es.',
      'Añadir el municipio INE además de la localidad/núcleo.',
    ],
    frecuencia:
      'Registro en vivo (el export refleja el estado actual); nosotros sincronizamos cada sábado.',
    licencia:
      'Sin licencia explícita: reutilización de información del sector público (Ley 37/2007).',
    score: {
      ubicacion: 2,
      identificador: 15,
      riqueza: 6,
      frecuencia: 20,
      acceso: 4,
      licencia: 4,
    },
  },
  {
    id: 'clm',
    ccaa: 'Castilla-La Mancha',
    registro:
      'Apartamentos turísticos y viviendas de uso turístico — Junta de Comunidades de Castilla-La Mancha',
    cities: 'Toledo, Cuenca y Albacete',
    links: [
      {
        label: 'Dataset (datosabiertos.castillalamancha.es)',
        url: 'https://datosabiertos.castillalamancha.es/dataset/apartamentos-tur%C3%ADsticos-y-viviendas-de-uso-tur%C3%ADstico-en-castilla-la-mancha',
      },
    ],
    datos: [
      'Nombre, subepígrafe separable (V.U.T., apartamento turístico y vivienda vacacional), dirección, municipio, código postal, plazas y año de alta. Sin número de registro público, sin coordenadas y sin referencia catastral.',
    ],
    posicionamiento:
      'Sin número de registro, derivamos una clave sintética estable de los campos de la ficha; la ubicación se geocodifica por dirección con CartoCiudad (IGN) y respaldo comercial en pasadas sucesivas.',
    problemas: [
      'Sin número de registro: cualquier corrección de nombre o dirección parece un alta más una baja.',
      'Sin coordenadas ni referencia catastral.',
      'El CSV publica el email y el teléfono del titular en el 100% de filas: los descartamos en la ingesta.',
      'Refresco semestral: el mapa manchego puede ir hasta seis meses por detrás del registro real.',
    ],
    mejoras: [
      'Publicar el número de registro de cada establecimiento.',
      'Añadir coordenadas o referencia catastral y acelerar el refresco.',
      'Retirar los datos de contacto personales del fichero público.',
    ],
    frecuencia: 'Volcado semestral (edición de mayo de 2026); nosotros sincronizamos cada domingo.',
    licencia: 'CC BY-SA',
    score: {
      ubicacion: 2,
      identificador: 0,
      riqueza: 13,
      frecuencia: 5,
      acceso: 7,
      licencia: 9,
    },
  },
  {
    id: 'ext',
    ccaa: 'Extremadura',
    registro: 'Listado de apartamentos turísticos — Junta de Extremadura',
    cities: 'Cáceres, Mérida y Badajoz',
    links: [
      {
        label: 'CSV de apartamentos turísticos (juntaex.es)',
        url: 'https://www.juntaex.es/documents/77055/5801338/AptosTuristicos.csv',
      },
    ],
    datos: [
      'Nombre, categoría, fecha de apertura, dirección, municipio, código postal, unidades de alojamiento, dormitorios y plazas. Extremadura no publica una figura separada de vivienda de uso turístico: este listado de apartamentos turísticos es lo único descargable.',
      'Cada apartamento turístico declara su número real de apartamentos (unidades de alojamiento), así que un edificio de 14 apartamentos cuenta como 14 viviendas, no como una — como en Andalucía. Es la segunda comunidad, junto a Andalucía, que permite contar los edificios completos por sus viviendas.',
    ],
    posicionamiento:
      'Sin número de registro, derivamos una clave sintética estable de los campos de la ficha; la ubicación se geocodifica por dirección con CartoCiudad (IGN) y respaldo comercial en pasadas sucesivas.',
    problemas: [
      'El fichero está estancado desde marzo de 2025: el mapa extremeño refleja ese momento, no el presente.',
      'Sin número de registro, sin coordenadas y sin referencia catastral.',
      'Los códigos postales pacenses pierden el cero inicial («6207»): los reconstruimos al ingerir.',
    ],
    mejoras: [
      'Retomar la publicación periódica del listado (o publicar el registro real de VUT, que existe administrativamente).',
      'Añadir número de registro y coordenadas.',
    ],
    frecuencia:
      'Estancada desde marzo de 2025; nosotros reintentamos cada domingo por si se actualiza.',
    licencia: 'CC BY 4.0',
    score: {
      ubicacion: 2,
      identificador: 0,
      riqueza: 12,
      frecuencia: 0,
      acceso: 5,
      licencia: 10,
    },
  },
  {
    id: 'eiv',
    ccaa: 'Islas Baleares (Ibiza)',
    registro: 'Portal de Registres Turístics — Consell Insular d’Eivissa',
    cities:
      'San José, Santa Eulalia del Río, San Antonio de Portmany, San Juan de Labritja e Ibiza',
    links: [
      {
        label: 'Buscador público del registro insular (registreturistic.conselldeivissa.es)',
        url: 'https://registreturistic.conselldeivissa.es/habitatges-turistics/',
      },
    ],
    datos: [
      'Número de inscripción (ETV/ET/VTV/VT), nombre comercial, habitaciones, plazas en el 100% de filas, dirección, municipio y — la joya — referencia catastral en el ~98,5%. Las cuatro figuras insulares ceden la vivienda completa.',
      'A diferencia de Mallorca y Menorca, el export no es un volcado del catálogo CAIB: se genera en vivo desde la base del registro en cada petición, así que refleja el estado del día.',
    ],
    posicionamiento:
      'Resolvemos la referencia catastral contra la Sede del Catastro (centroide de parcela, sin coste); el ~1,5% restante, con direcciones rústicas a menudo incompletas, va a geocodificación por dirección.',
    problemas: [
      'El export es una tabla HTML con extensión .xls en ISO-8859-1: hay que parsearla a mano.',
      'Publica el nombre del titular (con NIF), su teléfono y su email: los descartamos en la ingesta y no se espejan nunca.',
      'Algunos números de inscripción se repiten entre viviendas: derivamos una clave con la dirección para no perder registros.',
      'Sin licencia de datos abiertos ni presencia en ningún catálogo (el CKAN del Consell está abandonado desde 2024).',
    ],
    mejoras: [
      'Publicar el listado como dataset con licencia abierta (CC BY) en el catálogo CAIB, como ya hacen Mallorca y Menorca.',
      'Retirar el NIF y los datos de contacto personales del export público.',
      'Añadir coordenadas (el registro ya conoce la parcela catastral).',
    ],
    frecuencia:
      'Registro en vivo (el export se genera en cada consulta); nosotros sincronizamos cada martes.',
    licencia:
      'Sin licencia explícita: reutilización de información del sector público (Ley 37/2007).',
    score: {
      ubicacion: 20,
      identificador: 14,
      riqueza: 15,
      frecuencia: 20,
      acceso: 4,
      licencia: 4,
    },
  },
  {
    id: 'cnt',
    ccaa: 'Cantabria',
    registro:
      'Capa «Viviendas Turísticas» del servicio INSPIRE de la Dirección General de Turismo — Gobierno de Cantabria',
    cities:
      'Suances, San Vicente de la Barquera, Miengo, Piélagos, Laredo, Comillas, Santander, Ribamontán al Mar, Noja, Santillana del Mar, Castro-Urdiales y Torrelavega',
    links: [
      {
        label: 'Servicio ArcGIS REST (geoservicios.cantabria.es, capa 3)',
        url: 'https://geoservicios.cantabria.es/inspire/rest/services/Turismo_Infraestructura_Turistica/MapServer',
      },
    ],
    datos: [
      'Nombre comercial, modalidad separable (alquiler completo frente a compartido — el compartido suma habitantes, no hogares), plazas, dirección desglosada (vía, número, bloque, piso, puerta), código postal y coordenadas nativas en el 100% de los puntos. Sin número de registro utilizable: el campo de signatura dice literalmente «VUT» en todas las filas.',
    ],
    posicionamiento:
      'Usamos directamente las coordenadas publicadas por el Gobierno de Cantabria (el servicio las reproyecta a WGS84), validadas contra un radio municipal de plausibilidad.',
    problemas: [
      'Sin número de registro estable: cualquier corrección de dirección parece un alta más una baja (derivamos una clave sintética de la dirección, como en Madrid).',
      'El municipio llega como código INE de tres dígitos que hay que traducir con otra capa del propio servicio.',
      'La capa declara actualización «anual», aunque el recuento observado crece al ritmo de las regularizaciones del Decreto 50/2025: la cadencia real está por confirmar y la vigilamos.',
      'La licencia es la «de uso no comercial» del Decreto 87/2013, no una licencia abierta estándar.',
      'Publica el teléfono, el email y la web del titular: los descartamos en la ingesta.',
    ],
    mejoras: [
      'Publicar el número de registro real de cada vivienda (existe: la web del registro lo muestra).',
      'Declarar la frecuencia de actualización real del dato y una licencia abierta estándar.',
      'Retirar los datos de contacto personales del servicio público.',
    ],
    frecuencia:
      'Declarada anual, pero el recuento observado evoluciona con las regularizaciones (en vigilancia); nosotros sincronizamos cada viernes.',
    licencia: 'Licencia de Uso No Comercial del Decreto 87/2013 de Cantabria.',
    score: {
      ubicacion: 25,
      identificador: 0,
      riqueza: 16,
      frecuencia: 10,
      acceso: 8,
      licencia: 3,
    },
  },
  {
    id: 'lrj',
    ccaa: 'La Rioja',
    registro:
      'Registro de Proveedores de Servicios Turísticos (listado de viviendas autorizadas) — Gobierno de La Rioja',
    cities: 'Logroño, Haro y Ezcaray',
    links: [
      {
        label: 'Trámite con el «Listado de Viviendas autorizadas» (web.larioja.org)',
        url: 'https://web.larioja.org/oficina-electronica/tramite?n=24269',
      },
    ],
    datos: [
      'Número de registro estable (VT-LR-NNNN), fecha de comunicación de inicio, dirección con piso y puerta, y municipio. Sin plazas, sin código postal, sin coordenadas y sin referencia catastral. La VUT riojana es siempre cesión de la vivienda completa (Decreto 10/2017).',
    ],
    posicionamiento:
      'Sin ubicación en origen: geocodificamos cada dirección con CartoCiudad (IGN) y respaldo comercial en pasadas sucesivas. La capacidad (plazas) no puede mostrarse porque la fuente no la publica.',
    problemas: [
      'El listado es un PDF maquetado, no un dato estructurado: hay que reconstruir las filas por la posición del texto.',
      'La URL del PDF rota con cada edición mensual: hay que redescubrir el enlace en la página del trámite en cada sincronización.',
      'El cortafuegos del portal rechaza clientes automatizados sin cabeceras de navegador.',
      'Ningún portal de datos abiertos (ni el riojano ni datos.gob.es) cataloga el listado.',
    ],
    mejoras: [
      'Publicar el listado como CSV con licencia abierta en Dato Abierto La Rioja, con plazas y referencia catastral.',
      'Mantener una URL estable del recurso.',
    ],
    frecuencia: 'PDF mensual; nosotros sincronizamos cada lunes.',
    licencia:
      'Sin licencia explícita: reutilización de información del sector público (Ley 37/2007; Decreto 19/2013 de La Rioja).',
    score: {
      ubicacion: 2,
      identificador: 15,
      riqueza: 4,
      frecuencia: 10,
      acceso: 2,
      licencia: 4,
    },
  },
  {
    id: 'gij',
    ccaa: 'Asturias (Gijón)',
    registro: 'Visor municipal de viviendas de uso turístico con licencia — Ayuntamiento de Gijón',
    cities: 'Gijón',
    links: [
      {
        label: 'Visor de VUT (Urbanismo/PGO, documentos.gijon.es)',
        url: 'https://documentos.gijon.es/doc/Urbanismo/PGO/Interactivo_vuts/',
      },
    ],
    datos: [
      'Expediente urbanístico único y estable, calle y número en el 100% de las fichas, referencia catastral en el ~99,8% y coordenadas WGS84 en el 100%. Sin plazas y sin el número del registro turístico autonómico.',
      'El Principado de Asturias no publica el REAT en ningún formato reutilizable: este visor municipal es hoy la única fuente oficial per-vivienda de la ciudad.',
    ],
    posicionamiento:
      'Usamos directamente las coordenadas publicadas por el Ayuntamiento, validadas contra un radio municipal de plausibilidad.',
    problemas: [
      'El dato vive en el fichero JS de un visor cartográfico, no en un catálogo de datos abiertos, y sin licencia declarada.',
      'Refresco trimestral aproximado, ligado a la regeneración del visor.',
      'Sin plazas: Gijón queda fuera de las métricas de capacidad.',
      'Publica el nombre del interesado de cada expediente: lo descartamos en la ingesta.',
    ],
    mejoras: [
      'Publicar la capa como dataset con licencia abierta en el catálogo municipal.',
      'Añadir las plazas y el número del registro turístico autonómico.',
      'Que el Principado publique el REAT completo: cubriría Oviedo y el resto de Asturias.',
    ],
    frecuencia:
      'Actualización aproximadamente trimestral del visor; nosotros sincronizamos cada jueves.',
    licencia:
      'Sin licencia explícita: reutilización de información del sector público (Ley 37/2007).',
    score: {
      ubicacion: 25,
      identificador: 13,
      riqueza: 6,
      frecuencia: 7,
      acceso: 3,
      licencia: 4,
    },
  },
  {
    id: 'avi',
    ccaa: 'Asturias (Avilés)',
    registro: 'Dataset «Alojamientos turísticos» (extracto del REAT) — Ayuntamiento de Avilés',
    cities: 'Avilés',
    links: [
      {
        label: 'Dataset en el CKAN municipal (datos.aviles.es)',
        url: 'https://datos.gob.es/es/catalogo/l01330045-alojamientos-turisticos1',
      },
    ],
    datos: [
      'Signatura oficial del REAT (VUT.####.AS), nombre comercial, tipo separable, dirección desglosada, código postal, plazas y referencia catastral en el 100% de las VUT. Espejamos las viviendas de uso turístico, las viviendas vacacionales y los apartamentos turísticos (estos últimos contados por sus apartamentos estimados por capacidad).',
    ],
    posicionamiento:
      'Resolvemos la referencia catastral contra la Sede del Catastro (centroide de parcela, sin coste); las fichas sin ella se geocodifican por dirección.',
    problemas: [
      'El refresco declarado es mensual pero el dato observado va varios meses por detrás.',
      'El portal responde 403 a los clientes sin cabeceras de navegador.',
      'Cuela espacios duros (NBSP) dentro de los valores.',
      'Publica el nombre del titular: lo descartamos en la ingesta.',
    ],
    mejoras: [
      'Recuperar la cadencia mensual declarada.',
      'Demuestra que el REAT existe estructurado: que el Principado lo publique entero haría innecesario el espejo municipio a municipio.',
    ],
    frecuencia:
      'Declarada mensual, observada con retraso de meses; nosotros sincronizamos cada miércoles.',
    licencia: 'CC BY',
    score: {
      ubicacion: 20,
      identificador: 15,
      riqueza: 16,
      frecuencia: 5,
      acceso: 9,
      licencia: 10,
    },
  },
];

export function sourceTotal(entry: SourceEntry): number {
  return RUBRIC.reduce((sum, criterion) => sum + entry.score[criterion.key], 0);
}

/** Fecha de la última revisión editorial de esta página. */
const LAST_REVIEW =
  '24 de agosto de 2026 (revisión integral y cinco fuentes nuevas: Ibiza, Cantabria, La Rioja, Gijón y Avilés)';

const scoreColor = (pct: number) => (pct >= 75 ? '#315d4c' : pct >= 50 ? '#a06b1f' : '#9b3b30');

export function renderSourcesPage(): string {
  const ranked = [...SOURCES].sort((a, b) => sourceTotal(b) - sourceTotal(a));

  const rankingRows = ranked
    .map((entry, index) => {
      const total = sourceTotal(entry);
      return `
        <tr>
          <td>${index + 1}</td>
          <td><a href="#fuente-${entry.id}">${escapeHtml(entry.ccaa)}</a></td>
          <td class="num"><strong style="color:${scoreColor(total)}">${total}</strong>/100</td>
          <td><span style="display:block;height:8px;background:rgba(30,43,39,.08);border-radius:4px"><span style="display:block;height:8px;width:${total}%;background:${scoreColor(total)};border-radius:4px"></span></span></td>
        </tr>`;
    })
    .join('');

  const rubricItems = RUBRIC.map(
    (criterion) =>
      `<li><strong>${escapeHtml(criterion.label)} (hasta ${criterion.max} puntos)</strong>: ${escapeHtml(criterion.detail)}</li>`,
  ).join('');

  const sections = ranked
    .map((entry) => {
      const total = sourceTotal(entry);
      const breakdown = RUBRIC.map(
        (criterion) =>
          `<tr><td>${escapeHtml(criterion.label)}</td><td class="num">${entry.score[criterion.key]}/${criterion.max}</td></tr>`,
      ).join('');
      const list = (items: string[]) =>
        items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
      const links = entry.links
        .map(
          (link) =>
            `<li><a href="${escapeHtml(link.url)}" rel="noopener noreferrer">${escapeHtml(link.label)}</a></li>`,
        )
        .join('');
      return `
    <section id="fuente-${entry.id}" class="fuente">
      <header class="fuente-head">
        <h2>${escapeHtml(entry.ccaa)}</h2>
        <span class="fuente-score" style="background:${scoreColor(total)}">${total}/100</span>
      </header>
      <div class="fuente-body">
        <p><strong>${escapeHtml(entry.registro)}</strong> · Ciudades en el mapa: ${escapeHtml(entry.cities)}.</p>
        <h3>De dónde salen los datos</h3>
        <ul>${links}</ul>
        <h3>Qué datos sirve la fuente</h3>
        <ul>${list(entry.datos)}</ul>
        <h3>Cómo posicionamos cada vivienda</h3>
        <p>${escapeHtml(entry.posicionamiento)}</p>
        <h3>Problemas que hemos encontrado</h3>
        <ul>${list(entry.problemas)}</ul>
        <h3>Qué podría mejorar la administración</h3>
        <ul>${list(entry.mejoras)}</ul>
        <p class="fuente-meta"><strong>Frecuencia:</strong> ${escapeHtml(entry.frecuencia)}<br>
        <strong>Licencia:</strong> ${escapeHtml(entry.licencia)}</p>
        <details>
          <summary>Desglose de la puntuación</summary>
          <table>${breakdown}</table>
        </details>
      </div>
    </section>`;
    })
    .join('');

  const body = `
    <p class="eyebrow">Fuentes oficiales</p>
    <h1>Fuentes de datos, comunidad a comunidad</h1>
    <p>
      Todo lo que este mapa muestra como «registro oficial» procede de los registros de turismo
      autonómicos, sincronizados semanalmente. Esta página documenta cada fuente en un único
      lugar: de dónde descargamos, qué campos publica cada administración, cómo convertimos sus
      datos en puntos sobre el mapa, con qué problemas hemos topado y qué podría mejorar. Si una
      fuente cambia, esta página se actualiza con ella. <em>Última revisión: ${LAST_REVIEW}.</em>
    </p>

    <h2>Ranking de transparencia de datos</h2>
    <p>
      Puntuamos cada comunidad de 0 a 100 con una rúbrica común — mide la calidad del dato
      publicado y su refresco, no la política turística de nadie:
    </p>
    <ul>${rubricItems}</ul>
    <table class="ranking">
      <thead><tr><th>#</th><th>Comunidad</th><th class="num">Puntuación</th><th style="width:38%"></th></tr></thead>
      <tbody>${rankingRows}</tbody>
    </table>
    <p class="fuente-meta">
      La puntuación premia a quien publica coordenadas o referencia catastral, identificadores
      registrales estables, plazas, refresco frecuente y licencia abierta clara — todo lo que
      permite reutilizar el dato público sin fricción.
    </p>

    ${sections}

    <div class="note">
      <strong>Los edificios completos, comunidad a comunidad.</strong> Un edificio con decenas de
      apartamentos turísticos es la mayor pérdida de vivienda de un barrio —casi siempre fue un
      bloque de viviendas hasta que una empresa lo compró entero—, así que lo contamos por sus
      apartamentos, no como una sola vivienda. En cada registro comprobamos que la figura sea de
      apartamentos turísticos, nunca hoteles ni hostales. Cómo obtenemos el número de apartamentos:
      <ul>
        <li><strong>Dato exacto</strong> — Andalucía y Extremadura publican el número real de
        apartamentos de cada edificio; usamos ese. En la Región de Murcia el propio registro
        inscribe cada apartamento como asiento independiente (A.MU.###-n), así que el recuento
        también es exacto.</li>
        <li><strong>Estimado por capacidad</strong> — Cataluña, Castilla y León, Galicia, Navarra
        y Avilés publican la figura y su capacidad total, pero no el número de apartamentos. Lo estimamos con
        un ratio de <strong>~3,5 plazas por apartamento</strong>, medido sobre 817 apartamentos
        turísticos reales de Extremadura que sí declaran ambos datos (y confirmado en Andalucía). Es
        una estimación conservadora, no un dato exacto.</li>
        <li><strong>Aún no contable</strong> — Aragón publica la figura pero ni el número de
        apartamentos ni la capacidad, así que no hay con qué estimar.</li>
      </ul>
      Pedimos a todas las administraciones que publiquen las unidades de alojamiento de cada
      establecimiento: es el dato que convierte una estimación en un recuento exacto.
    </div>

    <div class="note">
      ¿Trabajas en una de estas administraciones y quieres mejorar vuestra puntuación — o hemos
      cometido un error? Escríbenos desde el formulario de contacto del <a href="/">mapa</a>
      (menú «Más» → Contacto). Ninguna administración citada respalda este proyecto; la crítica y el
      crédito son nuestros.
    </div>`;

  return pageShell({
    title: 'Fuentes de datos por comunidad — Viviendas Perdidas',
    description:
      'De dónde salen los datos oficiales del mapa: fuentes, campos, problemas y un ranking de transparencia de los registros de turismo autonómicos.',
    canonicalPath: '/fuentes',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Fuentes de datos por comunidad — Viviendas Perdidas',
      inLanguage: 'es',
      isAccessibleForFree: true,
    },
    body,
  });
}

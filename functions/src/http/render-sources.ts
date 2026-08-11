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
      'GRAVE: OpenRTA solo publica los establecimientos con consentimiento de publicación. La figura de apartamentos turísticos apenas aparece (21 en toda Sevilla, 24 en Málaga, 5 en Granada) pese a que las calles están llenas de placas AT: hemos verificado edificios enteros inscritos y con placa oficial (Alameda de Hércules 91 y 97, Jesús del Gran Poder 100, en Sevilla) que no existen en el dato abierto en NINGUNA figura. Los edificios completos convertidos en alojamiento — lo más lesivo para la vivienda — son justo lo que menos se publica.',
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
        url: 'https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatgesus-turistic',
      },
    ],
    datos: [
      'Número de inscripción estable, modalidad separable (vivienda de uso turístico frente a hogar compartido), dirección con piso y puerta, código postal y plazas en la mayoría de filas.',
    ],
    posicionamiento:
      'En Barcelona cruzamos por número de registro con el dataset municipal del Ajuntament, que sí publica coordenadas (100% ubicadas). En Girona y Tarragona el registro no trae coordenadas y geocodificamos por dirección con CartoCiudad y geocodificación comercial en varias pasadas.',
    problemas: [
      'El registro autonómico no publica coordenadas ni referencia catastral: fuera de Barcelona toda la ubicación corre de nuestra cuenta.',
      'Una parte de las altas no declara la capacidad (plazas), pese a ser un dato del registro.',
    ],
    mejoras: [
      'Publicar coordenadas o referencia catastral para toda Cataluña, como ya hace el Ajuntament de Barcelona con su término municipal.',
      'Completar el campo de plazas en todas las altas.',
    ],
    frecuencia: 'Dataset actualizado a diario; nosotros sincronizamos cada martes.',
    licencia:
      'Licencia abierta de uso de información – Cataluña (equivalente a CC BY); coordenadas municipales CC BY 4.0.',
    score: {
      ubicacion: 10,
      identificador: 15,
      riqueza: 16,
      frecuencia: 20,
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
    ],
    mejoras: [
      'Georreferenciar el 100% de las fichas (el propio Consell ya lo hace con la mitad).',
      'Separar en datasets distintos las viviendas de los operadores comerciales.',
    ],
    frecuencia:
      'Catálogo con refresco frecuente (declarado diario); nosotros sincronizamos cada jueves.',
    licencia: 'CC BY 4.0',
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
      'Número de registro, modalidad (apartamento turístico, vivienda turística y variantes rurales, separables), dirección, municipio y plazas.',
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
    frecuencia: 'Actualización periódica (aprox. semanal); nosotros sincronizamos cada sábado.',
    licencia: 'CC BY 4.0',
    score: {
      ubicacion: 5,
      identificador: 15,
      riqueza: 17,
      frecuencia: 13,
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
    ],
    posicionamiento:
      'Resolvemos la referencia catastral contra la Sede del Catastro (centroide de parcela, precisión de portal, sin coste); el resto se geocodifica por dirección con CartoCiudad (IGN) y respaldo comercial en pasadas sucesivas.',
    problemas: [
      'El «Excel» descargable es en realidad una tabla HTML con extensión .xls en codificación ISO-8859-1: hay que parsearla a mano.',
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
        url: 'https://abertos.xunta.gal/catalogo/cultura-ocio-turismo/-/dataset/0401/directorio-alojamientos-turisticos',
      },
    ],
    datos: [
      'Número de registro estable (VUT-CO-003589), denominación, tipo separable (viviendas de uso turístico y viviendas turísticas), habitaciones, plazas en el ~99%, dirección con parroquia y lugar, código postal y municipio.',
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
      'Número de registro estable (PP/NNNNNN), nombre, dirección, código postal, municipio, plazas y GPS en ~28% de filas. El registro completo mezcla todos los tipos de establecimiento: filtramos «Vivienda turística».',
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
];

export function sourceTotal(entry: SourceEntry): number {
  return RUBRIC.reduce((sum, criterion) => sum + entry.score[criterion.key], 0);
}

/** Fecha de la última revisión editorial de esta página. */
const LAST_REVIEW = '11 de agosto de 2026';

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
      <h2>${escapeHtml(entry.ccaa)}
        <span class="fuente-score" style="background:${scoreColor(total)}">${total}/100</span>
      </h2>
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
    </section>`;
    })
    .join('');

  const body = `
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
    <table>
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
      apartamentos turísticos es la mayor pérdida de vivienda de un barrio, pero solo cuenta bien
      si el registro publica cuántos apartamentos tiene. Hoy solo <strong>Andalucía y
      Extremadura</strong> lo publican, y ahí contamos cada edificio por sus viviendas reales.
      Cataluña, Navarra, Galicia, Castilla y León, Aragón y Murcia sí tienen una figura de
      «apartamentos turísticos», pero <strong>no publican el número de apartamentos por edificio</strong>
      (solo plazas o habitaciones), así que ahí no se pueden contar. Es un hueco de transparencia:
      pedimos a esas administraciones que publiquen las unidades de alojamiento de cada
      establecimiento.
    </div>

    <div class="note">
      ¿Trabajas en una de estas administraciones y quieres mejorar vuestra puntuación — o hemos
      cometido un error? Escríbenos desde el formulario de contacto del <a href="/">mapa</a>
      (icono del sobre). Ninguna administración citada respalda este proyecto; la crítica y el
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

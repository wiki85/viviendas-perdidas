/**
 * Attribution data for each mirrored official registry. The doc-id prefix of
 * a pin ('rta-…', 'cat-…') identifies its source. Every entry carries the
 * credit its license demands — keep these in sync with MethodologyPage,
 * AboutPage and the README when a registry is added.
 */
export type OfficialSourceInfo = {
  /** Short id, mirrors officialStats.source. */
  id:
    | 'openrta'
    | 'rtc'
    | 'gva'
    | 'caib'
    | 'nav'
    | 'eus'
    | 'mad'
    | 'can'
    | 'mur'
    | 'men'
    | 'gal'
    | 'cyl'
    | 'ara'
    | 'clm'
    | 'ext';
  registerName: string;
  registerUrl: string;
  publisher: string;
  licenseName: string;
  licenseUrl: string;
  /** Extra credit line (e.g. the coordinates provider), when required. */
  coordinatesCredit?: { name: string; url: string; licenseName: string; licenseUrl: string };
};

export const OFFICIAL_SOURCE_RTA: OfficialSourceInfo = {
  id: 'openrta',
  registerName: 'Registro de Turismo de Andalucía',
  registerUrl: 'https://datos.gob.es/es/catalogo/a01002820-openrta',
  publisher: 'Junta de Andalucía',
  licenseName: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
};

export const OFFICIAL_SOURCE_RTC: OfficialSourceInfo = {
  id: 'rtc',
  registerName: 'Registro de Turismo de Cataluña',
  registerUrl: 'https://analisi.transparenciacatalunya.cat/d/t2h3-cgys',
  publisher: "Generalitat de Catalunya (Departament d'Empresa i Treball)",
  licenseName: 'Licencia abierta de uso de información – Cataluña',
  licenseUrl: 'https://web.gencat.cat/ca/generalitat/dades-indicadors/dades-obertes/llicencies',
  coordinatesCredit: {
    name: 'Ajuntament de Barcelona (Open Data BCN)',
    url: 'https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatgesus-turistic',
    licenseName: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
};

export const OFFICIAL_SOURCE_GVA: OfficialSourceInfo = {
  id: 'gva',
  registerName: 'Registro de Turismo de la Comunidad Valenciana',
  registerUrl: 'https://dadesobertes.gva.es/es/dataset/758f8f8e-c5af-4622-b268-a6c591710a51',
  publisher: 'Generalitat Valenciana',
  licenseName: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  coordinatesCredit: {
    name: 'Sede Electrónica del Catastro',
    url: 'https://www.sedecatastro.gob.es/',
    licenseName: 'Dirección General del Catastro',
    licenseUrl: 'https://www.catastro.hacienda.gob.es/esp/condiciones_acceso.asp',
  },
};

export const OFFICIAL_SOURCE_CAIB: OfficialSourceInfo = {
  id: 'caib',
  registerName: 'Registro de Viviendas Turísticas y Estancias Turísticas en Vivienda de Mallorca',
  registerUrl: 'https://intranet.caib.es/opendatacataleg/ca/dataset/habitatges-turistics-mallorca',
  publisher: 'Consell de Mallorca (Dades Obertes GOIB)',
  licenseName: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
};

export const OFFICIAL_SOURCE_NAV: OfficialSourceInfo = {
  id: 'nav',
  registerName: 'Registro de Turismo de Navarra',
  registerUrl:
    'https://datosabiertos.navarra.es/es/dataset/alojamientos-inscritos-en-el-registro-de-turismo-de-navarra',
  publisher: 'Gobierno de Navarra',
  licenseName: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
};

export const OFFICIAL_SOURCE_EUS: OfficialSourceInfo = {
  id: 'eus',
  registerName: 'Registro de Empresas y Actividades Turísticas de Euskadi (REATE)',
  registerUrl:
    'https://opendata.euskadi.eus/catalogo/-/viviendas-y-habitaciones-de-vivienda-particular-para-uso-turistico-en-euskadi/',
  publisher: 'Gobierno Vasco (Open Data Euskadi)',
  licenseName: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
};

export const OFFICIAL_SOURCE_MAD: OfficialSourceInfo = {
  id: 'mad',
  registerName: 'Declaraciones responsables de viviendas de uso turístico',
  registerUrl:
    'https://datos.comunidad.madrid/dataset/declaraciones_actividad_viviendas_uso_turistico',
  publisher: 'Comunidad de Madrid',
  licenseName: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  coordinatesCredit: {
    name: 'CartoCiudad (IGN)',
    url: 'https://www.cartociudad.es/',
    licenseName: 'Instituto Geográfico Nacional',
    licenseUrl: 'https://www.ign.es/',
  },
};

export const OFFICIAL_SOURCE_CAN: OfficialSourceInfo = {
  id: 'can',
  registerName: 'Registro General Turístico de Canarias (viviendas vacacionales)',
  registerUrl:
    'https://datos.canarias.es/catalogos/general/dataset/establecimientos-extrahoteleros-de-tipologia-vivienda-vacacional-inscritos-en-el-registro',
  publisher: 'Gobierno de Canarias',
  licenseName: 'Reutilización con atribución (aviso legal datos.canarias.es)',
  licenseUrl: 'https://datos.canarias.es/portal/aviso-legal-y-condiciones-de-uso',
};

export const OFFICIAL_SOURCE_MUR: OfficialSourceInfo = {
  id: 'mur',
  registerName: 'Listado público de viviendas vacacionales del ITREM (Región de Murcia)',
  registerUrl: 'https://www.turismoregiondemurcia.es/es/etudoc.parser/?vtip=6&documento=xls',
  publisher: 'Instituto de Turismo de la Región de Murcia',
  licenseName: 'Reutilización de información del sector público (Ley 37/2007)',
  licenseUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-19814',
  coordinatesCredit: {
    name: 'Sede Electrónica del Catastro',
    url: 'https://www.sedecatastro.gob.es/',
    licenseName: 'Dirección General del Catastro',
    licenseUrl: 'https://www.catastro.hacienda.gob.es/esp/condiciones_acceso.asp',
  },
};

export const OFFICIAL_SOURCE_MEN: OfficialSourceInfo = {
  id: 'men',
  registerName: 'Registro de estancias y viviendas turísticas de vacaciones de Menorca',
  registerUrl:
    'https://intranet.caib.es/opendatacataleg/ca/dataset/estades-i-habitatges-turistics-vacacionals-de-menorca',
  publisher: 'Consell Insular de Menorca (Dades Obertes GOIB)',
  licenseName: 'CC BY',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
};

export const OFFICIAL_SOURCE_GAL: OfficialSourceInfo = {
  id: 'gal',
  registerName: 'Directorio de alojamientos del REAT (Galicia)',
  registerUrl:
    'https://abertos.xunta.gal/catalogo/cultura-ocio-turismo/-/dataset/0401/directorio-alojamientos-turisticos',
  publisher: 'Xunta de Galicia (Turismo de Galicia)',
  licenseName: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.es',
};

export const OFFICIAL_SOURCE_CYL: OfficialSourceInfo = {
  id: 'cyl',
  registerName: 'Registro de Turismo de Castilla y León',
  registerUrl:
    'https://analisis.datosabiertos.jcyl.es/explore/dataset/registro-de-turismo-de-castilla-y-leon/',
  publisher: 'Junta de Castilla y León',
  licenseName: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
};

export const OFFICIAL_SOURCE_ARA: OfficialSourceInfo = {
  id: 'ara',
  registerName: 'Listado público de viviendas de uso turístico del Registro de Turismo de Aragón',
  registerUrl:
    'https://aplicaciones.aragon.es/wturpub/informes/exportarActividadesTuristicasExcel?tipoExportacion=exportarVUT',
  publisher: 'Gobierno de Aragón',
  licenseName: 'Reutilización de información del sector público (Ley 37/2007)',
  licenseUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-19814',
};

export const OFFICIAL_SOURCE_CLM: OfficialSourceInfo = {
  id: 'clm',
  registerName: 'Apartamentos turísticos y viviendas de uso turístico de Castilla-La Mancha',
  registerUrl:
    'https://datosabiertos.castillalamancha.es/dataset/apartamentos-tur%C3%ADsticos-y-viviendas-de-uso-tur%C3%ADstico-en-castilla-la-mancha',
  publisher: 'Junta de Comunidades de Castilla-La Mancha',
  licenseName: 'CC BY-SA',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.es',
};

export const OFFICIAL_SOURCE_EXT: OfficialSourceInfo = {
  id: 'ext',
  registerName: 'Listado de apartamentos turísticos de Extremadura',
  registerUrl: 'https://www.juntaex.es/documents/77055/5801338/AptosTuristicos.csv',
  publisher: 'Junta de Extremadura',
  licenseName: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
};

export const OFFICIAL_SOURCES: readonly OfficialSourceInfo[] = [
  OFFICIAL_SOURCE_RTA,
  OFFICIAL_SOURCE_RTC,
  OFFICIAL_SOURCE_GVA,
  OFFICIAL_SOURCE_CAIB,
  OFFICIAL_SOURCE_NAV,
  OFFICIAL_SOURCE_EUS,
  OFFICIAL_SOURCE_MAD,
  OFFICIAL_SOURCE_CAN,
  OFFICIAL_SOURCE_MUR,
  OFFICIAL_SOURCE_MEN,
  OFFICIAL_SOURCE_GAL,
  OFFICIAL_SOURCE_CYL,
  OFFICIAL_SOURCE_ARA,
  OFFICIAL_SOURCE_CLM,
  OFFICIAL_SOURCE_EXT,
];

/** Source of an official pin, derived from its mirror doc id. */
export function officialSourceForPinId(pinId: string): OfficialSourceInfo {
  if (pinId.startsWith('cat-')) return OFFICIAL_SOURCE_RTC;
  if (pinId.startsWith('gva-')) return OFFICIAL_SOURCE_GVA;
  if (pinId.startsWith('caib-')) return OFFICIAL_SOURCE_CAIB;
  if (pinId.startsWith('nav-')) return OFFICIAL_SOURCE_NAV;
  if (pinId.startsWith('eus-')) return OFFICIAL_SOURCE_EUS;
  if (pinId.startsWith('mad-')) return OFFICIAL_SOURCE_MAD;
  if (pinId.startsWith('can-')) return OFFICIAL_SOURCE_CAN;
  if (pinId.startsWith('mur-')) return OFFICIAL_SOURCE_MUR;
  if (pinId.startsWith('men-')) return OFFICIAL_SOURCE_MEN;
  if (pinId.startsWith('gal-')) return OFFICIAL_SOURCE_GAL;
  if (pinId.startsWith('cyl-')) return OFFICIAL_SOURCE_CYL;
  if (pinId.startsWith('ara-')) return OFFICIAL_SOURCE_ARA;
  if (pinId.startsWith('clm-')) return OFFICIAL_SOURCE_CLM;
  if (pinId.startsWith('ext-')) return OFFICIAL_SOURCE_EXT;
  return OFFICIAL_SOURCE_RTA;
}

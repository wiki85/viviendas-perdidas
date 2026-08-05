/**
 * Attribution data for each mirrored official registry. The doc-id prefix of
 * a pin ('rta-…', 'cat-…') identifies its source. Every entry carries the
 * credit its license demands — keep these in sync with MethodologyPage,
 * AboutPage and the README when a registry is added.
 */
export type OfficialSourceInfo = {
  /** Short id, mirrors officialStats.source. */
  id: 'openrta' | 'rtc' | 'gva' | 'caib' | 'nav' | 'eus' | 'mad' | 'can';
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

export const OFFICIAL_SOURCES: readonly OfficialSourceInfo[] = [
  OFFICIAL_SOURCE_RTA,
  OFFICIAL_SOURCE_RTC,
  OFFICIAL_SOURCE_GVA,
  OFFICIAL_SOURCE_CAIB,
  OFFICIAL_SOURCE_NAV,
  OFFICIAL_SOURCE_EUS,
  OFFICIAL_SOURCE_MAD,
  OFFICIAL_SOURCE_CAN,
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
  return OFFICIAL_SOURCE_RTA;
}

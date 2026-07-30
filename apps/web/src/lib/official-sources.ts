/**
 * Attribution data for each mirrored official registry. The doc-id prefix of
 * a pin ('rta-…', 'cat-…') identifies its source. Every entry carries the
 * credit its license demands — keep these in sync with MethodologyPage,
 * AboutPage and the README when a registry is added.
 */
export type OfficialSourceInfo = {
  /** Short id, mirrors officialStats.source. */
  id: 'openrta' | 'rtc' | 'gva';
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
  registerName: 'Registre de Turisme de Catalunya',
  registerUrl: 'https://analisi.transparenciacatalunya.cat/d/t2h3-cgys',
  publisher: "Generalitat de Catalunya (Departament d'Empresa i Treball)",
  licenseName: 'Llicència oberta d’ús d’informació – Catalunya',
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
  registerName: 'Registre de Turisme de la Comunitat Valenciana',
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

export const OFFICIAL_SOURCES: readonly OfficialSourceInfo[] = [
  OFFICIAL_SOURCE_RTA,
  OFFICIAL_SOURCE_RTC,
  OFFICIAL_SOURCE_GVA,
];

/** Source of an official pin, derived from its mirror doc id. */
export function officialSourceForPinId(pinId: string): OfficialSourceInfo {
  if (pinId.startsWith('cat-')) return OFFICIAL_SOURCE_RTC;
  if (pinId.startsWith('gva-')) return OFFICIAL_SOURCE_GVA;
  return OFFICIAL_SOURCE_RTA;
}

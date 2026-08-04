import type { CityImpactSources } from '../domain/types';
import { calculateImpact } from './impact';

/**
 * Client-side mirror of the city-page impact math. KEEP IN SYNC with
 * `functions/src/domain/city-impact.ts`, where every constant is documented
 * with its primary source (INE EPF 2024, INE population structure,
 * Ministerio de Educación 2023-24, IECA/SIMA e Idescat/EMEX Censo 2021).
 */
export const HOUSEHOLD_ANNUAL_SPEND_EUR = 34_044;
export const HOUSEHOLD_FOOD_SPEND_EUR = 5_379;
export const UNDER_15_SHARE = 0.138;
export const PUPILS_PER_CLASSROOM = 21;

export const CITY_MAIN_DWELLINGS: Record<string, number> = {
  sevilla: 266_588,
  malaga: 218_245,
  granada: 98_316,
  cordoba: 122_668,
  cadiz: 46_071,
  huelva: 55_813,
  jaen: 43_149,
  almeria: 75_980,
  'jerez-de-la-frontera': 79_708,
  marbella: 56_491,
  barcelona: 671_177,
  valencia: 328_979,
  alicante: 132_637,
  benidorm: 27_912,
  palma: 159_316,
  pamplona: 78_924,
  donostia: 79_285,
  bilbao: 147_655,
  madrid: 1_320_531,
  torrevieja: 36_829,
  calp: 9_839,
  denia: 17_648,
  calvia: 20_609,
  alcudia: 7_983,
  girona: 38_711,
  tarragona: 53_551,
  'las-palmas-de-gran-canaria': 143_217,
  'santa-cruz-de-tenerife': 81_056,
  arona: 33_223,
  adeje: 19_314,
  'san-bartolome-de-tirajana': 22_312,
  mogan: 8_118,
  'la-oliva': 11_087,
  yaiza: 6_431,
  tias: 7_881,
};

export type CityImpactSummary = {
  /** Community dwellings + every official VUT. */
  dwellingsTotal: number;
  /** Displaced households: community families + official whole homes. */
  households: number;
  inhabitants: number;
  annualSpendEur: number;
  under15: number;
  classrooms: number;
  /** Official VUT as % of the city's main homes (null without census data). */
  officialStockSharePct: number | null;
  hasOfficial: boolean;
};

/** Null when the city has nothing worth announcing. */
export function summarizeCityImpact(
  cityId: string,
  sources: CityImpactSources,
): CityImpactSummary | null {
  const community = sources.community;
  const official = sources.official;
  const officialEntire = official?.entireHomes ?? 0;
  const households = (community?.lostFamilies ?? 0) + officialEntire;
  const inhabitants =
    (community?.lostInhabitants ?? 0) +
    calculateImpact(officialEntire).lostInhabitants +
    (official?.roomsInhabitants ?? 0);
  const dwellingsTotal = (community?.lostDwellings ?? 0) + (official?.total ?? 0);
  if (households < 1) return null;
  const under15 = Math.round(inhabitants * UNDER_15_SHARE);
  const mainDwellings = CITY_MAIN_DWELLINGS[cityId];
  const officialTotal = official?.total ?? 0;
  return {
    dwellingsTotal,
    households,
    inhabitants,
    annualSpendEur: households * HOUSEHOLD_ANNUAL_SPEND_EUR,
    under15,
    classrooms: Math.round(under15 / PUPILS_PER_CLASSROOM),
    officialStockSharePct:
      mainDwellings !== undefined && officialTotal > 0
        ? Math.round((officialTotal / mainDwellings) * 1000) / 10
        : null,
    hasOfficial: officialTotal > 0,
  };
}

/** 306.396.000 → '306 M€'; 1.234.000 → '1,2 M€'; 620.000 → '620.000 €'. */
export function formatEurosCompact(value: number): string {
  if (value >= 995_000) {
    const millions = value / 1_000_000;
    return `${millions.toLocaleString('es-ES', {
      maximumFractionDigits: millions >= 10 ? 0 : 1,
    })} M€`;
  }
  return `${(Math.round(value / 1_000) * 1_000).toLocaleString('es-ES')} €`;
}

/**
 * Constants behind the city-page impact estimates. Every figure has a public
 * primary source, quoted in the page footer and in /metodologia:
 *
 * - HOUSEHOLD_ANNUAL_SPEND_EUR / HOUSEHOLD_FOOD_SPEND_EUR: INE, Encuesta de
 *   Presupuestos Familiares 2024 — average household spend of 34.044 €/year,
 *   of which 15,8% goes to food and non-alcoholic drinks (≈5.379 €).
 * - UNDER_15_SHARE: INE, population structure — 13,8% of Spain's population
 *   is under 15.
 * - PUPILS_PER_CLASSROOM: Ministerio de Educación, 2023-24 — ≈21 pupils per
 *   class blending public (20) and subsidised (22,9) primary schools.
 * - CITY_CENSUS: IECA (SIMA municipal sheets) for the Andalusian cities,
 *   Idescat (EMEX) for Barcelona and INE (municipal census/padrón tables)
 *   for the Valencian cities — main family dwellings from the 2021 Census
 *   and the latest total population, per mirrored city.
 */
export const HOUSEHOLD_ANNUAL_SPEND_EUR = 34_044;
export const HOUSEHOLD_FOOD_SPEND_EUR = 5_379;
export const UNDER_15_SHARE = 0.138;
export const PUPILS_PER_CLASSROOM = 21;

export interface CityCensus {
  /** Viviendas familiares principales, Censo 2021 (INE/IECA). */
  mainDwellings: number;
  /** Población total 2025 (IECA, SIMA). */
  population: number;
}

export const CITY_CENSUS: Record<string, CityCensus> = {
  sevilla: { mainDwellings: 266_588, population: 688_714 },
  malaga: { mainDwellings: 218_245, population: 597_173 },
  granada: { mainDwellings: 98_316, population: 235_294 },
  cordoba: { mainDwellings: 122_668, population: 324_159 },
  cadiz: { mainDwellings: 46_071, population: 110_123 },
  huelva: { mainDwellings: 55_813, population: 143_774 },
  jaen: { mainDwellings: 43_149, population: 112_119 },
  almeria: { mainDwellings: 75_980, population: 204_772 },
  'jerez-de-la-frontera': { mainDwellings: 79_708, population: 215_025 },
  marbella: { mainDwellings: 56_491, population: 160_478 },
  barcelona: { mainDwellings: 671_177, population: 1_686_208 },
  valencia: { mainDwellings: 328_979, population: 840_792 },
  alicante: { mainDwellings: 132_637, population: 366_221 },
  benidorm: { mainDwellings: 27_912, population: 77_327 },
  palma: { mainDwellings: 159_316, population: 434_786 },
  pamplona: { mainDwellings: 78_924, population: 209_094 },
  donostia: { mainDwellings: 79_285, population: 189_866 },
  bilbao: { mainDwellings: 147_655, population: 351_124 },
  madrid: { mainDwellings: 1_320_531, population: 3_506_730 },
  torrevieja: { mainDwellings: 36_829, population: 98_533 },
  calp: { mainDwellings: 9_839, population: 27_616 },
  denia: { mainDwellings: 17_648, population: 47_261 },
  calvia: { mainDwellings: 20_609, population: 53_793 },
  alcudia: { mainDwellings: 7_983, population: 21_907 },
  girona: { mainDwellings: 38_711, population: 108_666 },
  tarragona: { mainDwellings: 53_551, population: 143_649 },
  'las-palmas-de-gran-canaria': { mainDwellings: 143_217, population: 381_868 },
  'santa-cruz-de-tenerife': { mainDwellings: 81_056, population: 211_957 },
  arona: { mainDwellings: 33_223, population: 87_793 },
  adeje: { mainDwellings: 19_314, population: 50_021 },
  'san-bartolome-de-tirajana': { mainDwellings: 22_312, population: 54_291 },
  mogan: { mainDwellings: 8_118, population: 21_172 },
  'la-oliva': { mainDwellings: 11_087, population: 30_022 },
  yaiza: { mainDwellings: 6_431, population: 18_842 },
  tias: { mainDwellings: 7_881, population: 21_613 },
  cartagena: { mainDwellings: 77_228, population: 220_704 },
  'san-javier': { mainDwellings: 12_364, population: 36_524 },
  'torre-pacheco': { mainDwellings: 12_310, population: 41_479 },
  murcia: { mainDwellings: 163_570, population: 479_405 },
  mazarron: { mainDwellings: 13_277, population: 35_449 },
  'los-alcazares': { mainDwellings: 6_692, population: 20_408 },
  'san-pedro-del-pinatar': { mainDwellings: 9_499, population: 29_674 },
  aguilas: { mainDwellings: 13_329, population: 37_811 },
  ciutadella: { mainDwellings: 11_921, population: 32_431 },
  mao: { mainDwellings: 11_317, population: 30_666 },
  'sant-lluis': { mainDwellings: 2_754, population: 7_312 },
  'es-mercadal': { mainDwellings: 2_288, population: 6_459 },
  alaior: { mainDwellings: 3_801, population: 10_217 },
  vigo: { mainDwellings: 114_082, population: 294_489 },
  'a-coruna': { mainDwellings: 104_637, population: 251_543 },
  'santiago-de-compostela': { mainDwellings: 39_315, population: 100_965 },
  sanxenxo: { mainDwellings: 6_578, population: 18_016 },
  'o-grove': { mainDwellings: 4_281, population: 10_833 },
  leon: { mainDwellings: 55_185, population: 123_446 },
  burgos: { mainDwellings: 73_410, population: 177_402 },
  salamanca: { mainDwellings: 63_989, population: 146_110 },
  valladolid: { mainDwellings: 127_185, population: 302_614 },
  zamora: { mainDwellings: 26_793, population: 59_815 },
  avila: { mainDwellings: 24_433, population: 59_107 },
  soria: { mainDwellings: 16_713, population: 41_025 },
  zaragoza: { mainDwellings: 280_054, population: 693_091 },
  jaca: { mainDwellings: 5_540, population: 14_024 },
  benasque: { mainDwellings: 958, population: 2_359 },
  'sallent-de-gallego': { mainDwellings: 653, population: 1_505 },
  panticosa: { mainDwellings: 380, population: 910 },
  teruel: { mainDwellings: 14_270, population: 36_655 },
  toledo: { mainDwellings: 32_321, population: 87_216 },
  cuenca: { mainDwellings: 22_187, population: 53_600 },
  albacete: { mainDwellings: 66_328, population: 175_400 },
  caceres: { mainDwellings: 39_048, population: 96_651 },
  merida: { mainDwellings: 23_245, population: 60_225 },
  badajoz: { mainDwellings: 58_015, population: 150_209 },
};

export interface CityImpactInput {
  cityId: string;
  /** Displaced households: community families + official whole homes. */
  households: number;
  /** Displaced inhabitants across both sources (INE household size). */
  inhabitants: number;
  /** Official registry dwellings for the city (0 where not mirrored). */
  officialTotal: number;
  /** Official tourist places (beds) for the city. */
  officialPlaces: number;
}

export interface CityImpactExtras {
  /** Yearly household consumption leaving the neighbourhood, in euros. */
  annualSpendEur: number;
  /** The food-only slice: the spend that sustains local commerce. */
  foodSpendEur: number;
  /** Children under 15 who no longer live in those homes. */
  under15: number;
  /** Equivalent school classrooms. */
  classrooms: number;
  /** Official VUT as % of the city's main homes (null without census data). */
  officialStockSharePct: number | null;
  /** Official tourist places per 100 inhabitants (null without census data). */
  placesPer100: number | null;
}

export function computeCityImpact(input: CityImpactInput): CityImpactExtras {
  const census = CITY_CENSUS[input.cityId];
  const under15 = Math.round(input.inhabitants * UNDER_15_SHARE);
  return {
    annualSpendEur: input.households * HOUSEHOLD_ANNUAL_SPEND_EUR,
    foodSpendEur: input.households * HOUSEHOLD_FOOD_SPEND_EUR,
    under15,
    classrooms: Math.round(under15 / PUPILS_PER_CLASSROOM),
    officialStockSharePct:
      census !== undefined && input.officialTotal > 0
        ? Math.round((input.officialTotal / census.mainDwellings) * 1000) / 10
        : null,
    placesPer100:
      census !== undefined && input.officialPlaces > 0
        ? Math.round((input.officialPlaces / census.population) * 1000) / 10
        : null,
  };
}

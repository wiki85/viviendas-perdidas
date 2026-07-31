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

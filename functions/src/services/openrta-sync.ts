import { Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebase.js';
import { parseRtaRecord, type OfficialVutRecord } from '../domain/openrta.js';

const SEARCH_URL = 'https://datos.juntadeandalucia.es/api/v0/openrta/search';
const PAGE_SIZE = 10_000;

/**
 * Andalusian municipalities we mirror (OpenRTA enum spelling). The API cannot
 * paginate beyond 10k, but an ASC+DESC pass by id covers up to 20k per
 * municipality — enough for every current value (Málaga tops at ~12.7k).
 */
export const SYNCED_MUNICIPALITIES: readonly string[] = [
  'SEVILLA',
  'MÁLAGA',
  'GRANADA',
  'CÓRDOBA',
  'CÁDIZ',
  'HUELVA',
  'JAÉN',
  'ALMERÍA',
  'JEREZ DE LA FRONTERA',
  'MARBELLA',
];

async function fetchPage(
  municipality: string,
  mode: 'ASC' | 'DESC',
  fetchImplementation: typeof fetch,
): Promise<{ totalHits: number; results: Record<string, unknown>[] }> {
  const url = new URL(SEARCH_URL);
  const params: Record<string, string> = {
    id: '-',
    object_type: 'Vivienda de uso turístico',
    category: '-',
    group: '-',
    modality: '-',
    province: '-',
    municipality,
    order_by: 'id',
    mode,
    size: String(PAGE_SIZE),
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetchImplementation(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    throw new Error(`OpenRTA devolvió HTTP ${response.status} para ${municipality}`);
  }
  const payload = (await response.json()) as {
    total_hits?: number;
    results?: Record<string, unknown>[];
  };
  return { totalHits: payload.total_hits ?? 0, results: payload.results ?? [] };
}

async function fetchMunicipality(
  municipality: string,
  fetchImplementation: typeof fetch,
): Promise<OfficialVutRecord[]> {
  const ascending = await fetchPage(municipality, 'ASC', fetchImplementation);
  const rows = new Map<unknown, Record<string, unknown>>();
  for (const row of ascending.results) rows.set(row.id, row);
  if (ascending.totalHits > PAGE_SIZE) {
    const descending = await fetchPage(municipality, 'DESC', fetchImplementation);
    for (const row of descending.results) rows.set(row.id, row);
    if (ascending.totalHits > PAGE_SIZE * 2) {
      logger.warn('OpenRTA municipality exceeds double-pass coverage', {
        municipality,
        totalHits: ascending.totalHits,
      });
    }
  }
  const records: OfficialVutRecord[] = [];
  for (const row of rows.values()) {
    const record = parseRtaRecord(row);
    if (record !== null) records.push(record);
  }
  return records;
}

async function writeBatched(records: OfficialVutRecord[], geohashFor: GeohashFn): Promise<void> {
  const CHUNK = 400;
  for (let index = 0; index < records.length; index += CHUNK) {
    const batch = db.batch();
    for (const record of records.slice(index, index + CHUNK)) {
      const reference = db.collection('officialVut').doc(`rta-${record.rtaId}`);
      batch.set(reference, {
        ...record,
        geohash:
          record.latitude !== null && record.longitude !== null
            ? geohashFor([record.latitude, record.longitude])
            : null,
        syncedAt: Timestamp.now(),
      });
    }
    await batch.commit();
  }
}

type GeohashFn = (location: [number, number]) => string;

export interface OpenRtaSyncSummary {
  municipalities: number;
  records: number;
}

export async function runOpenRtaSync(
  fetchImplementation: typeof fetch,
  geohashFor: GeohashFn,
): Promise<OpenRtaSyncSummary> {
  let total = 0;
  for (const municipality of SYNCED_MUNICIPALITIES) {
    const records = await fetchMunicipality(municipality, fetchImplementation);
    await writeBatched(records, geohashFor);
    const cityId = records[0]?.cityId;
    if (cityId !== undefined) {
      const entire = records.filter((record) => record.entire);
      await db
        .collection('officialStats')
        .doc(cityId)
        .set({
          cityId,
          municipality,
          total: records.length,
          entireHomes: entire.length,
          roomsOnly: records.length - entire.length,
          places: records.reduce((sum, record) => sum + record.places, 0),
          withLocation: records.filter((record) => record.latitude !== null).length,
          source: 'openrta',
          updatedAt: Timestamp.now(),
        });
    }
    total += records.length;
    logger.info('OpenRTA municipality synced', { municipality, records: records.length });
  }
  return { municipalities: SYNCED_MUNICIPALITIES.length, records: total };
}

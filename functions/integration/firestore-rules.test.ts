import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'demo-viviendas-perdidas-rules';

function emulatorAddress(): { host: string; port: number } {
  const [host = '127.0.0.1', rawPort = '8080'] = (
    process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
  ).split(':');
  const port = Number(rawPort);
  if (!Number.isInteger(port))
    throw new Error('FIRESTORE_EMULATOR_HOST contiene un puerto inválido.');
  return { host, port };
}

describe('Firestore security rules', () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    const rules = await readFile(resolve(process.cwd(), '../firestore.rules'), 'utf8');
    environment = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { ...emulatorAddress(), rules },
    });
  });

  beforeEach(async () => {
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore();
      await Promise.all([
        setDoc(doc(database, 'listings', 'active-listing'), {
          status: 'active',
          cityId: 'valencia',
          geohash: 'ezp8',
        }),
        setDoc(doc(database, 'listings', 'flagged-listing'), {
          status: 'flagged',
          cityId: 'valencia',
          geohash: 'ezp9',
        }),
        setDoc(doc(database, 'listings', 'removed-listing'), {
          status: 'removed',
          cityId: 'valencia',
          geohash: 'ezpb',
        }),
        setDoc(doc(database, 'aggregates', 'valencia'), { listingsCount: 2 }),
        setDoc(doc(database, 'votes', 'private-vote'), {
          listingId: 'active-listing',
          kind: 'confirm',
        }),
      ]);
    });
  });

  afterAll(async () => {
    if (environment) await environment.cleanup();
  });

  it('allows public reads only for non-removed listings', async () => {
    const database = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(database, 'listings', 'active-listing')));
    await assertSucceeds(getDoc(doc(database, 'listings', 'flagged-listing')));
    await assertFails(getDoc(doc(database, 'listings', 'removed-listing')));
  });

  it('requires a status-constrained listing query', async () => {
    const database = environment.unauthenticatedContext().firestore();
    await assertSucceeds(
      getDocs(
        query(collection(database, 'listings'), where('status', 'in', ['active', 'flagged'])),
      ),
    );
    await assertFails(getDocs(collection(database, 'listings')));
  });

  it('exposes aggregates while keeping votes and every client write private', async () => {
    const database = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(database, 'aggregates', 'valencia')));
    await assertFails(getDoc(doc(database, 'votes', 'private-vote')));
    await assertFails(
      setDoc(doc(database, 'listings', 'client-write'), {
        status: 'active',
        cityId: 'valencia',
        geohash: 'ezpc',
      }),
    );
  });
});

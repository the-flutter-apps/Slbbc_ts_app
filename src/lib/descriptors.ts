/**
 * Employee descriptor storage for offline face matching.
 *
 * Stores face descriptors from backend in IndexedDB for offline matching.
 * Refreshed daily or on demand.
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'slbbc-descriptors';
const DB_VERSION = 1;
const STORE_NAME = 'employees';

interface StoredEmployee {
  id: string;
  employeeCode: string;
  fullName: string;
  photoUrl: string;
  designation: string;
  descriptors: number[][]; // Stored as arrays, converted to Float32Array on read
}

interface DescriptorCache {
  vendorId: string;
  generatedAt: string;
  cachedAt: number;
  employees: StoredEmployee[];
}

let dbInstance: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });

  return dbInstance;
}

/**
 * Save employee descriptors to cache.
 */
export async function saveDescriptors(cache: {
  vendorId: string;
  generatedAt: string;
  employees: Array<{
    id: string;
    employeeCode: string;
    fullName: string;
    photoUrl: string;
    designation: string;
    descriptors: Float32Array[];
  }>;
}): Promise<void> {
  const db = await getDb();

  // Convert Float32Arrays to regular arrays for storage
  const storedEmployees: StoredEmployee[] = cache.employees.map((emp) => ({
    ...emp,
    descriptors: emp.descriptors.map((desc) => Array.from(desc)),
  }));

  const cacheData: DescriptorCache = {
    vendorId: cache.vendorId,
    generatedAt: cache.generatedAt,
    cachedAt: Date.now(),
    employees: storedEmployees,
  };

  await db.put(STORE_NAME, cacheData, 'current');

  console.log(`[Descriptors] Cached ${cache.employees.length} employees`);
}

/**
 * Get all cached employee descriptors.
 */
export async function getDescriptors(): Promise<{
  vendorId: string;
  generatedAt: string;
  cachedAt: number;
  employees: Array<{
    id: string;
    employeeCode: string;
    fullName: string;
    photoUrl: string;
    designation: string;
    descriptors: Float32Array[];
  }>;
} | null> {
  const db = await getDb();
  const cached = await db.get(STORE_NAME, 'current');

  if (!cached) {
    return null;
  }

  // Convert arrays back to Float32Arrays
  return {
    ...cached,
    employees: cached.employees.map((emp: StoredEmployee) => ({
      ...emp,
      descriptors: emp.descriptors.map((desc: number[]) => new Float32Array(desc)),
    })),
  };
}

/**
 * Check if descriptors are stale (older than 24 hours).
 */
export async function areDescriptorsStale(): Promise<boolean> {
  const cached = await getDescriptors();

  if (!cached) {
    return true;
  }

  const age = Date.now() - cached.cachedAt;
  const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

  return age > MAX_AGE;
}

/**
 * Clear cached descriptors.
 */
export async function clearDescriptors(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, 'current');
  console.log('[Descriptors] Cache cleared');
}

/**
 * Refresh descriptors from backend if stale.
 */
export async function refreshDescriptorsIfNeeded(
  fetchFn: () => Promise<{
    vendorId: string;
    generatedAt: string;
    employees: Array<{
      id: string;
      employeeCode: string;
      fullName: string;
      photoUrl: string;
      designation: string;
      descriptors: number[][];
    }>;
  }>,
): Promise<boolean> {
  const isStale = await areDescriptorsStale();

  if (!isStale) {
    console.log('[Descriptors] Cache is fresh, skipping refresh');
    return false;
  }

  console.log('[Descriptors] Cache is stale, fetching from backend...');

  try {
    const response = await fetchFn();

    // Convert number[][] to Float32Array[]
    const employees = response.employees.map((emp) => ({
      ...emp,
      descriptors: emp.descriptors.map((desc) => new Float32Array(desc)),
    }));

    await saveDescriptors({
      ...response,
      employees,
    });

    console.log('[Descriptors] Successfully refreshed cache');
    return true;
  } catch (error) {
    console.error('[Descriptors] Failed to refresh cache:', error);
    return false;
  }
}

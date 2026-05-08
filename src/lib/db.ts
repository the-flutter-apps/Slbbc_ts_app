/**
 * IndexedDB database initialization and connection management.
 *
 * Single database: 'slbbc-kiosk-db'
 * Lazy-init pattern: opened once, connection reused.
 *
 * See `.claude/context/OFFLINE_STRATEGY.md` for schema design.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { QueuedAttendance, CachedEmployeeDescriptor } from '@/types';

const DB_NAME = 'slbbc-kiosk-db';
const DB_VERSION = 1;

export interface KioskDB {
  'attendance-queue': {
    key: string; // clientGeneratedId
    value: QueuedAttendance;
    indexes: {
      syncStatus: string;
      capturedAt: string;
    };
  };
  'employee-descriptors': {
    key: string; // employee id
    value: CachedEmployeeDescriptor;
  };
  config: {
    key: string; // config key name
    value: unknown; // flexible config values
  };
}

let dbPromise: Promise<IDBPDatabase<KioskDB>> | null = null;

/**
 * Get the IndexedDB connection (lazy-init singleton).
 * Call this in every queue operation.
 */
export async function getDb(): Promise<IDBPDatabase<KioskDB>> {
  if (!dbPromise) {
    dbPromise = openDB<KioskDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v0 → v1: Initial schema
        if (oldVersion < 1) {
          // Attendance queue store
          const queueStore = db.createObjectStore('attendance-queue', {
            keyPath: 'clientGeneratedId',
          });
          queueStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          queueStore.createIndex('capturedAt', 'capturedAt', { unique: false });

          // Employee descriptors store (for offline face matching)
          db.createObjectStore('employee-descriptors', {
            keyPath: 'id',
          });

          // Config store (kiosk identity + settings)
          db.createObjectStore('config', {
            keyPath: 'key',
          });
        }

        // Future migrations:
        // if (oldVersion < 2) { ... }
      },
      blocked() {
        console.warn('[DB] Database upgrade blocked by another open tab');
      },
      blocking() {
        console.warn('[DB] Database blocking another tab from upgrading');
      },
    });
  }

  return dbPromise;
}

/**
 * Reset the database connection (for tests).
 */
export function resetDb(): void {
  dbPromise = null;
}

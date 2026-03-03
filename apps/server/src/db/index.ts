import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Database } from 'bun:sqlite';
import { config } from '../config.js';
import { runMigrations } from './migrate.js';

let _db: Database | null = null;

export function initializeDatabase(
  dbPath?: string,
): Database {
  const path = dbPath ?? config.databasePath;

  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new Database(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000'); // wait up to 5s for locked DB before SQLITE_BUSY
  db.exec('PRAGMA secure_delete = ON');  // zero-fill deleted data to prevent forensic recovery

  runMigrations(db);

  _db = db;
  return db;
}

export function getDatabase(): Database {
  if (!_db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return _db;
}


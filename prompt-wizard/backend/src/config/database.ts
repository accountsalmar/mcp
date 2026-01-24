import Database from 'better-sqlite3';
import { config } from './environment.js';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export async function initializeDatabase(): Promise<Database.Database> {
  // Ensure data directory exists
  const dbDir = dirname(config.databasePath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Create database connection
  db = new Database(config.databasePath);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  await runMigrations(db);

  return db;
}

async function runMigrations(database: Database.Database): Promise<void> {
  // Create migrations tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Get list of applied migrations
  const applied = database.prepare('SELECT name FROM migrations').all() as { name: string }[];
  const appliedNames = new Set(applied.map(m => m.name));

  // Get migration files
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const migrationsDir = join(__dirname, '..', 'database', 'migrations');

  if (!existsSync(migrationsDir)) {
    console.log('No migrations directory found, skipping migrations');
    return;
  }

  // Read and execute each migration
  const migrationFiles = ['001_initial_schema.sql'];

  for (const file of migrationFiles) {
    if (appliedNames.has(file)) {
      continue;
    }

    const migrationPath = join(migrationsDir, file);
    if (!existsSync(migrationPath)) {
      console.warn(`Migration file not found: ${migrationPath}`);
      continue;
    }

    console.log(`Applying migration: ${file}`);
    const sql = readFileSync(migrationPath, 'utf-8');

    database.exec(sql);
    database.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
    console.log(`Migration applied: ${file}`);
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

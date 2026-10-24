import type { Db } from "./types";
import { migrations as defaultMigrations, type Migration } from "./migrations";

const CREATE_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
)`;

function appliedVersions(db: Db): Set<number> {
  const rows = db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[];
  return new Set(rows.map((row) => row.version));
}

/** Applies pending migrations in version order, each in its own transaction. Returns applied versions. */
export function runMigrations(
  db: Db,
  migrations: readonly Migration[] = defaultMigrations,
): number[] {
  db.exec(CREATE_MIGRATIONS_TABLE);
  const done = appliedVersions(db);
  const pending = [...migrations]
    .filter((migration) => !done.has(migration.version))
    .sort((a, b) => a.version - b.version);
  const record = db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)");

  for (const migration of pending) {
    db.transaction(() => {
      db.exec(migration.sql);
      record.run(migration.version, new Date().toISOString());
    })();
  }
  return pending.map((migration) => migration.version);
}

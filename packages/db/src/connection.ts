import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { runMigrations } from "./migrate";
import type { Db } from "./types";

export const IN_MEMORY = ":memory:";
/** How long a connection waits on a locked database before failing (web + realtime share the file). */
const BUSY_TIMEOUT_MS = 5_000;

export interface OpenDatabaseOptions {
  /** Run pending migrations after opening (default true). */
  migrate?: boolean;
}

/** Sort key for Vietnamese titles: case- and tone-insensitive, with đ ordered right after d. */
export function titleSortKey(title: string): string {
  return title.toLowerCase().replaceAll("đ", "d\u{10FFFF}").normalize("NFD").replace(/\p{M}/gu, "");
}

/** Opens (creating if needed) the SQLite file with WAL + foreign keys, then migrates. */
export function openDatabase(path: string, options: OpenDatabaseOptions = {}): Db {
  if (path !== IN_MEMORY) mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
  db.pragma("synchronous = NORMAL");
  // Vietnamese-aware ordering: `ORDER BY title_key(title)`.
  db.function("title_key", { deterministic: true }, (title) => titleSortKey(String(title ?? "")));
  if (options.migrate !== false) runMigrations(db);
  return db;
}

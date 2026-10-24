import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { IN_MEMORY, migrations, openDatabase, runMigrations } from "../src";

describe("migrations", () => {
  const dirs: string[] = [];
  afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

  it("creates every table and records the version", () => {
    const db = openDatabase(IN_MEMORY);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .pluck()
      .all();
    expect(tables).toEqual(
      expect.arrayContaining([
        "meetings",
        "segments",
        "translations",
        "marks",
        "glossary_terms",
        "term_variants",
        "schema_migrations",
      ]),
    );
    expect(db.prepare("SELECT version FROM schema_migrations").pluck().all()).toEqual(
      migrations.map((m) => m.version),
    );
  });

  it("is idempotent", () => {
    const db = openDatabase(IN_MEMORY);
    expect(runMigrations(db)).toEqual([]);
  });

  it("opens a file database in WAL mode with foreign keys, creating the directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "recap-db-"));
    dirs.push(dir);
    const db = openDatabase(join(dir, "nested", "recap.db"));
    expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    db.close();
  });

  it("applies migrations with gaps in numbering and out of order", () => {
    const db = openDatabase(IN_MEMORY);
    const make = (version: number) => ({
      version,
      name: `t${version}`,
      sql: `CREATE TABLE gap_${version} (x INTEGER);`,
    });
    // 100 is applied first, then 50 arrives later (e.g. a parallel branch's migration).
    expect(runMigrations(db, [...migrations, make(100)])).toEqual([100]);
    expect(runMigrations(db, [...migrations, make(100), make(50), make(70)])).toEqual([50, 70]);
    expect(runMigrations(db, [...migrations, make(100), make(50), make(70)])).toEqual([]);
  });

  it("adds marks.label and marks.updated_at in migration 006", () => {
    const db = openDatabase(IN_MEMORY);
    const columns = db.prepare("PRAGMA table_info(marks)").all() as { name: string }[];
    expect(columns.map((c) => c.name)).toEqual(expect.arrayContaining(["label", "updated_at"]));
  });

  it("rolls back a failing migration", () => {
    const db = openDatabase(IN_MEMORY);
    const broken = {
      version: 999,
      name: "broken",
      sql: "CREATE TABLE ok_t (x); SELECT nope FROM missing;",
    };
    expect(() => runMigrations(db, [...migrations, broken])).toThrow();
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE name = 'ok_t'").get();
    expect(exists).toBeUndefined();
  });
});

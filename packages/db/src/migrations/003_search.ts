const TOKENIZE = "tokenize = 'unicode61 remove_diacritics 2'";

/** unicode61 cannot fold đ/Đ (no decomposition), so both index and query fold them to d/D. */
const fold = (column: string) => `replace(replace(${column}, 'đ', 'd'), 'Đ', 'D')`;

/**
 * One FTS5 index over `table.column`. The index owns a (folded) copy of the text, keyed by the
 * source row's rowid, and triggers keep it in sync; existing rows are backfilled.
 * Caveat: keyed on the implicit rowid, so after a VACUUM drop and recreate (re-run) the backfill.
 */
function index(table: string, column: string, extra?: string) {
  const fts = `${table}_fts`;
  const cols = extra ? `${column}, ${extra} UNINDEXED` : column;
  const insertCols = extra ? `rowid, ${column}, ${extra}` : `rowid, ${column}`;
  const values = (row: "new" | "old") =>
    `${row}.rowid, ${fold(`${row}.${column}`)}${extra ? `, ${row}.${extra}` : ""}`;
  return `
CREATE VIRTUAL TABLE ${fts} USING fts5(${cols}, ${TOKENIZE});
INSERT INTO ${fts} (${insertCols}) SELECT rowid, ${fold(column)}${extra ? `, ${extra}` : ""} FROM ${table};

CREATE TRIGGER ${table}_fts_ai AFTER INSERT ON ${table} BEGIN
  INSERT INTO ${fts} (${insertCols}) VALUES (${values("new")});
END;
CREATE TRIGGER ${table}_fts_ad AFTER DELETE ON ${table} BEGIN
  DELETE FROM ${fts} WHERE rowid = old.rowid;
END;
CREATE TRIGGER ${table}_fts_au AFTER UPDATE OF ${column} ON ${table} BEGIN
  DELETE FROM ${fts} WHERE rowid = old.rowid;
  INSERT INTO ${fts} (${insertCols}) VALUES (${values("new")});
END;
`;
}

export const migration003 = {
  version: 3,
  name: "search",
  sql: [
    index("meetings", "title"),
    index("segments", "text", "meeting_id"),
    index("translations", "text", "segment_id"),
  ].join("\n"),
} as const;

export const migration007 = {
  version: 7,
  name: "mark_updated_at",
  sql: `
ALTER TABLE marks ADD COLUMN updated_at TEXT;
`,
} as const;

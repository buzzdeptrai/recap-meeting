export const migration006 = {
  version: 6,
  name: "mark_label",
  sql: `
ALTER TABLE marks ADD COLUMN label TEXT;
`,
} as const;

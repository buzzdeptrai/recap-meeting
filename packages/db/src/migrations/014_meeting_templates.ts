/**
 * Meeting templates + per-meeting extra instructions (backlog B2).
 * - meetings.template_id: meeting type ('general' default); known ids live in @recap/core.
 * - meetings.extra_instructions: free text (max 500 chars, enforced by the API) from the owner;
 *   NULL = none. Both feed the minutes prompt.
 * - minutes.template_id / minutes.instructions_fingerprint: what the AI minutes were generated
 *   with; a different value now means the minutes are stale ("template_changed" /
 *   "instructions_changed"). NULL on rows from before, which never flag stale.
 */
export const migration014 = {
  version: 14,
  name: "meeting_templates",
  sql: `
ALTER TABLE meetings ADD COLUMN template_id TEXT NOT NULL DEFAULT 'general';
ALTER TABLE meetings ADD COLUMN extra_instructions TEXT;
ALTER TABLE minutes ADD COLUMN template_id TEXT;
ALTER TABLE minutes ADD COLUMN instructions_fingerprint TEXT;
`,
} as const;

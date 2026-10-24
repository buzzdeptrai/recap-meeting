/**
 * Indexes for the meetings list (filters, sorts, per-meeting aggregates). No data changes.
 * - segments (meeting_id, created_at): MAX(created_at) per meeting is an index seek (minutes staleness).
 * - usage_events (meeting_id, cost_usd): SUM(cost_usd) per meeting is index-only.
 * - meetings (status, created_at): status chip counts and filtered, newest-first pages.
 */
export const migration009 = {
  version: 9,
  name: "list_indexes",
  sql: `
CREATE INDEX idx_segments_meeting_created ON segments (meeting_id, created_at);
CREATE INDEX idx_usage_events_meeting_cost ON usage_events (meeting_id, cost_usd);
CREATE INDEX idx_meetings_status_created ON meetings (status, created_at);
`,
} as const;

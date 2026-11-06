/**
 * Who may see and act on a meeting. One rule, used by web (REST + pages), realtime (`start`) and
 * the SQL list/search scoping in @recap/db:
 * - admin: every meeting;
 * - member: only meetings they own (`meetings.owner_id`);
 * - a meeting without owner (`null`) is visible to admins only.
 * Callers answer "not found" (never "forbidden") when this is false, so a meeting's existence is
 * not revealed to someone who may not see it.
 */
export interface MeetingViewer {
  id: string;
  role: "admin" | "member";
}

export function canAccessMeeting(viewer: MeetingViewer, ownerId: string | null): boolean {
  if (viewer.role === "admin") return true;
  return ownerId !== null && ownerId === viewer.id;
}

/**
 * Owner id a SQL query must be restricted to, or null when no restriction applies (admin, or an
 * internal caller passing no viewer). Keeps the SQL scoping consistent with `canAccessMeeting`.
 */
export function ownerRestriction(viewer: MeetingViewer | undefined): string | null {
  if (!viewer || viewer.role === "admin") return null;
  return viewer.id;
}

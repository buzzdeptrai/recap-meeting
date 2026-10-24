import { createRepositories, openDatabase, type Repositories } from "@recap/db";
import { resolveDbPath } from "./repo-root";

/** Server-only. Never import from client components. */
const globalForDb = globalThis as typeof globalThis & { __recapRepos?: Repositories };

/** One connection per server process (survives dev hot reloads). */
export function getRepositories(): Repositories {
  // A dev hot reload may keep a repository set built before a repo / method existed
  // (`sessions`, the transcript pager, soft delete): rebuild it then.
  const cached = globalForDb.__recapRepos;
  if (
    cached?.sessions &&
    typeof cached.segments.anchorAt === "function" &&
    typeof cached.meetings.softDelete === "function"
  ) {
    return cached;
  }
  const fresh = createRepositories(openDatabase(resolveDbPath()));
  globalForDb.__recapRepos = fresh;
  return fresh;
}

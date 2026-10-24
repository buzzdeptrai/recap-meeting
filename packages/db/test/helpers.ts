import { IN_MEMORY, createRepositories, openDatabase } from "../src";

/** In-memory DB with deterministic ids and a controllable clock. */
export function setup() {
  const db = openDatabase(IN_MEMORY);
  let counter = 0;
  let clock = Date.parse("2026-10-21T09:00:00.000Z");
  const repos = createRepositories(db, {
    newId: () => `id-${++counter}`,
    now: () => new Date(clock).toISOString(),
  });
  const advance = (ms: number) => {
    clock += ms;
  };
  return { db, repos, advance };
}

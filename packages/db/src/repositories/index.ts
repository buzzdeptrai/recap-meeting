import { randomUUID } from "node:crypto";
import type { Db, RepoContext } from "../types";
import { createGlossaryRepository } from "./glossary";
import { createMarksRepository } from "./marks";
import { createMeetingNotesRepository } from "./meeting-notes";
import { createMeetingsRepository } from "./meetings";
import { createMinutesRepository } from "./minutes";
import { createMinutesRunsRepository } from "./minutes-runs";
import { createSegmentsRepository } from "./segments";
import { createSessionsRepository } from "./sessions";
import { createTranslationsRepository } from "./translations";
import { createUsageRepository } from "./usage";
import { createUsersRepository } from "./users";

export interface RepositoryOptions {
  now?: () => string;
  newId?: () => string;
}

/** Builds every repository over one connection. `now` / `newId` are injectable for tests. */
export function createRepositories(db: Db, options: RepositoryOptions = {}) {
  const context: RepoContext = {
    db,
    now: options.now ?? (() => new Date().toISOString()),
    newId: options.newId ?? randomUUID,
  };
  return {
    meetings: createMeetingsRepository(context),
    segments: createSegmentsRepository(context),
    translations: createTranslationsRepository(context),
    marks: createMarksRepository(context),
    notes: createMeetingNotesRepository(context),
    glossary: createGlossaryRepository(context),
    minutes: createMinutesRepository(context),
    minutesRuns: createMinutesRunsRepository(context),
    usage: createUsageRepository(context),
    users: createUsersRepository(context),
    sessions: createSessionsRepository(context),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export * from "./glossary";
export * from "./marks";
export * from "./meeting-list-extras";
export * from "./meeting-list-query";
export * from "./meeting-search";
export * from "./meeting-notes";
export * from "./meetings";
export * from "./meetings-trash";
export * from "./minutes";
export * from "./minutes-runs";
export * from "./minutes-staleness";
export * from "./segment-pages";
export * from "./segments";
export * from "./transcript-search";
export * from "./sessions";
export * from "./translations";
export * from "./usage";
export * from "./usage-recorder";
export * from "./users";

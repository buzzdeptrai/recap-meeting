import { markLabelSchema, type Mark } from "@recap/core";
import type { Repositories } from "@recap/db";
import { z } from "zod";
import { getRepositories } from "./db";
import { ServiceError } from "./service-error";

export const patchMarkSchema = z.object({ label: markLabelSchema });

const markNotFound = () => new ServiceError(404, "NOT_FOUND", "Không tìm thấy dấu này.");

/** Renames a mark of an ended meeting (live meetings edit marks over the WebSocket). */
export function renameMark(
  meetingId: string,
  markId: string,
  label: string,
  repos: Repositories = getRepositories(),
): Mark {
  const stored = repos.marks.updateLabel(meetingId, markId, label);
  if (!stored) throw markNotFound();
  return { id: stored.id, kind: stored.kind, atMs: stored.atMs, label: stored.label };
}

export function deleteMark(
  meetingId: string,
  markId: string,
  repos: Repositories = getRepositories(),
): { id: string } {
  if (!repos.marks.remove(meetingId, markId)) throw markNotFound();
  return { id: markId };
}

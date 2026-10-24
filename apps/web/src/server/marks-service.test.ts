import { IN_MEMORY, createRepositories, openDatabase } from "@recap/db";
import { describe, expect, it } from "vitest";
import { deleteMark, patchMarkSchema, renameMark } from "./marks-service";

function setup() {
  const repos = createRepositories(openDatabase(IN_MEMORY));
  const { id } = repos.meetings.create({ title: "Họp" });
  const mark = repos.marks.insert({ meetingId: id, kind: "topic", atMs: 1_000 });
  return { repos, meetingId: id, mark };
}

describe("marks-service", () => {
  it("renames and clears a label", () => {
    const { repos, meetingId, mark } = setup();
    expect(renameMark(meetingId, mark.id, "Giá", repos)).toMatchObject({
      id: mark.id,
      label: "Giá",
    });
    expect(renameMark(meetingId, mark.id, "", repos).label).toBeNull();
  });

  it("deletes a mark and reports unknown ones as 404", () => {
    const { repos, meetingId, mark } = setup();
    expect(deleteMark(meetingId, mark.id, repos)).toEqual({ id: mark.id });
    expect(() => deleteMark(meetingId, mark.id, repos)).toThrow(/Không tìm thấy/);
    expect(() => renameMark(meetingId, "nope", "x", repos)).toThrow(/Không tìm thấy/);
  });

  it("validates the label length", () => {
    expect(patchMarkSchema.safeParse({ label: "x".repeat(121) }).success).toBe(false);
    expect(patchMarkSchema.safeParse({ label: "ok" }).success).toBe(true);
  });
});

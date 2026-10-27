import { NOTES_PER_MEETING_MAX, createNoteSchema, updateNoteSchema } from "@recap/core";
import { IN_MEMORY, createRepositories, openDatabase } from "@recap/db";
import { describe, expect, it } from "vitest";
import { createNote, deleteNote, listNotes, updateNote } from "./notes-service";

function setup() {
  const repos = createRepositories(openDatabase(IN_MEMORY));
  const { id } = repos.meetings.create({ title: "Họp" });
  return { repos, meetingId: id };
}

describe("notes-service", () => {
  it("creates, lists in meeting order, edits and deletes", () => {
    const { repos, meetingId } = setup();
    const late = createNote(meetingId, { content: "muộn", atMs: 9_000 }, repos).note;
    const untimed = createNote(meetingId, { content: "không giờ" }, repos).note;
    const early = createNote(meetingId, { content: "sớm", atMs: 1_000 }, repos).note;
    expect(listNotes(meetingId, repos).notes.map((n) => n.id)).toEqual([
      early.id,
      late.id,
      untimed.id,
    ]);
    expect(updateNote(meetingId, early.id, { content: "đã sửa" }, repos).note.content).toBe(
      "đã sửa",
    );
    expect(deleteNote(meetingId, early.id, repos)).toEqual({ id: early.id });
    expect(() => deleteNote(meetingId, early.id, repos)).toThrow(/Không tìm thấy/);
  });

  it("hides notes and rejects writes for a soft-deleted or unknown meeting", () => {
    const { repos, meetingId } = setup();
    createNote(meetingId, { content: "a" }, repos);
    repos.meetings.softDelete(meetingId);
    expect(() => listNotes(meetingId, repos)).toThrow(/Không tìm thấy/);
    expect(() => createNote(meetingId, { content: "b" }, repos)).toThrow(/Không tìm thấy/);
    expect(() => createNote("nope", { content: "b" }, repos)).toThrow(/Không tìm thấy/);
  });

  it("caps the notes per meeting with a 409", () => {
    const { repos, meetingId } = setup();
    for (let i = 0; i < NOTES_PER_MEETING_MAX; i++)
      createNote(meetingId, { content: `n${i}` }, repos);
    expect(() => createNote(meetingId, { content: "x" }, repos)).toThrow(/tối đa/);
  });
});

describe("note schemas", () => {
  it("trims and rejects empty or oversized content", () => {
    expect(createNoteSchema.parse({ content: "  hi  " }).content).toBe("hi");
    expect(createNoteSchema.safeParse({ content: "   " }).success).toBe(false);
    expect(createNoteSchema.safeParse({ content: "x".repeat(1_001) }).success).toBe(false);
  });

  it("validates the offset", () => {
    expect(createNoteSchema.safeParse({ content: "a", atMs: -1 }).success).toBe(false);
    expect(createNoteSchema.safeParse({ content: "a", atMs: 1.5 }).success).toBe(false);
    expect(createNoteSchema.safeParse({ content: "a", atMs: null }).success).toBe(true);
  });

  it("needs at least one field to update", () => {
    expect(updateNoteSchema.safeParse({}).success).toBe(false);
    expect(updateNoteSchema.safeParse({ atMs: null }).success).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { notesFingerprint, minutesStaleReasons, type StaleInput } from "../src";
import { setup } from "./helpers";

function seed() {
  const ctx = setup();
  const meeting = ctx.repos.meetings.create({ title: "Họp" });
  return { ...ctx, meetingId: meeting.id };
}

describe("meeting notes repository", () => {
  it("stores trimmed content with offset and manual-edit stamps", () => {
    const { repos, meetingId } = seed();
    const note = repos.notes.insert({ meetingId, atMs: 5_000, content: "  Chốt giá  " });
    expect(note).toMatchObject({ content: "Chốt giá", atMs: 5_000, position: 1 });
    expect(note.lastManualEdit).toBe(note.createdAt);
  });

  it("orders by offset, untimed last, ties by insertion", () => {
    const { repos, meetingId } = seed();
    const a = repos.notes.insert({ meetingId, content: "untimed" });
    const b = repos.notes.insert({ meetingId, atMs: 9_000, content: "late" });
    const c = repos.notes.insert({ meetingId, atMs: 1_000, content: "early" });
    const d = repos.notes.insert({ meetingId, atMs: 1_000, content: "early 2" });
    expect(repos.notes.list(meetingId).map((n) => n.id)).toEqual([c.id, d.id, b.id, a.id]);
  });

  it("updates content and offset; keeps the offset when omitted, clears on null", () => {
    const { repos, meetingId, advance } = seed();
    const note = repos.notes.insert({ meetingId, atMs: 2_000, content: "a" });
    advance(1_000);
    const edited = repos.notes.update(meetingId, note.id, { content: "b" });
    expect(edited).toMatchObject({ content: "b", atMs: 2_000 });
    expect((edited?.updatedAt ?? "") > note.updatedAt).toBe(true);
    expect(edited?.lastManualEdit).toBe(edited?.updatedAt);
    expect(repos.notes.update(meetingId, note.id, { atMs: null })?.atMs).toBeNull();
    expect(repos.notes.update(meetingId, "nope", { content: "x" })).toBeUndefined();
  });

  it("does not touch a note through another meeting", () => {
    const { repos, meetingId } = seed();
    const other = repos.meetings.create({ title: "Khác" }).id;
    const note = repos.notes.insert({ meetingId, content: "a" });
    expect(repos.notes.update(other, note.id, { content: "x" })).toBeUndefined();
    expect(repos.notes.remove(other, note.id)).toBe(false);
    expect(repos.notes.remove(meetingId, note.id)).toBe(true);
  });

  it("hides the notes of a soft-deleted meeting and shows them again after restore", () => {
    const { repos, meetingId } = seed();
    repos.notes.insert({ meetingId, content: "a" });
    expect(repos.meetings.softDelete(meetingId).ok).toBe(true);
    expect(repos.notes.list(meetingId)).toEqual([]);
    expect(repos.notes.latestChangeAt(meetingId)).toBeNull();
    repos.meetings.restore(meetingId);
    expect(repos.notes.list(meetingId)).toHaveLength(1);
  });

  it("reports the newest change time", () => {
    const { repos, meetingId, advance } = seed();
    expect(repos.notes.latestChangeAt(meetingId)).toBeNull();
    const note = repos.notes.insert({ meetingId, content: "a" });
    advance(500);
    const edited = repos.notes.update(meetingId, note.id, { content: "b" });
    expect(repos.notes.latestChangeAt(meetingId)).toBe(edited?.updatedAt);
  });

  it("cascades with the meeting row", () => {
    const { db, repos, meetingId } = seed();
    repos.notes.insert({ meetingId, content: "a" });
    db.prepare("DELETE FROM meetings WHERE id = ?").run(meetingId);
    expect(db.prepare("SELECT COUNT(*) FROM meeting_notes").pluck().get()).toBe(0);
  });
});

describe("notes staleness", () => {
  const base: StaleInput = {
    generatedAt: "2026-10-22T08:00:00.000Z",
    latestSegmentAt: null,
    latestMarkChangeAt: null,
    latestNoteChangeAt: null,
    stored: { promptVersion: "4", model: "m", marksFingerprint: "a", notesFingerprint: "n1" },
    current: { promptVersion: "4", model: "m", marksFingerprint: "a", notesFingerprint: "n1" },
  };

  it("is fresh when nothing changed", () => {
    expect(minutesStaleReasons(base)).toEqual([]);
  });

  it("flags a note added or edited after generation", () => {
    const reasons = minutesStaleReasons({
      ...base,
      latestNoteChangeAt: "2026-10-22T08:01:00.000Z",
    });
    expect(reasons).toEqual(["notes_changed"]);
  });

  it("flags a deleted note through the fingerprint, once", () => {
    const current = { ...base.current, notesFingerprint: "n2" };
    expect(minutesStaleReasons({ ...base, current })).toEqual(["notes_changed"]);
    expect(
      minutesStaleReasons({ ...base, current, latestNoteChangeAt: "2026-10-22T08:01:00.000Z" }),
    ).toEqual(["notes_changed"]);
  });

  it("never flags a row that has no stored notes fingerprint", () => {
    const stored = { ...base.stored, notesFingerprint: null };
    const current = { ...base.current, notesFingerprint: "n2" };
    expect(minutesStaleReasons({ ...base, stored, current })).toEqual([]);
  });

  it("fingerprints notes independently of order and sensitive to every field", () => {
    const a = { id: "1", atMs: 1_000, content: "x" };
    const b = { id: "2", atMs: null, content: "y" };
    const full = notesFingerprint([a, b]);
    expect(notesFingerprint([b, a])).toBe(full);
    expect(notesFingerprint([a])).not.toBe(full);
    expect(notesFingerprint([a, { ...b, content: "z" }])).not.toBe(full);
    expect(notesFingerprint([a, { ...b, atMs: 5 }])).not.toBe(full);
  });
});

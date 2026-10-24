# Phase 1 — Internal MVP (contract)

> Read with `docs/PLAN.md` (engineering rules), `docs/ARCHITECTURE.md`, `docs/DESIGN.md`.
> Local only: no git commit, no publishing. Never print API key values. Agents use model Sonnet.
> Tick the task checkbox in `docs/PLAN.md` and append one line to the ledger when done.

## Goal
After a meeting ends the user can: generate minutes (VI / EN) → review and edit → export Word;
find old meetings by title/transcript text; the app is behind a simple login.

## Minutes content (the contract — `@recap/core` `minutes.ts`, zod + types)
```ts
type TopicStatus = "decided" | "open" | "rejected";   // UI: Đã chốt / Chưa chốt / Bác bỏ
interface MinutesContent {
  summary: string;                                   // 2-4 sentences
  topics: {
    id: string;                                      // stable uuid, assigned by the app not the LLM
    title: string;
    keyPoints: { text: string; atMs: number | null }[];
    status: TopicStatus;
    conclusion: { text: string; atMs: number | null; marked: boolean } | null; // marked = backed by a user mark
  }[];
  actionItems: { id: string; task: string; owner: string | null; due: string | null; atMs: number | null }[];
  openIssues: { id: string; text: string }[];
}
```
Stored per language: table `minutes(meeting_id FK, lang 'vi'|'en', content TEXT json, source 'ai'|'edited',
model TEXT, generated_at TEXT, updated_at TEXT, PRIMARY KEY(meeting_id, lang))` (migration 002).

## Generation rules (`@recap/minutes`)
- Input: meeting (title, agenda), segments with translations, marks, glossary terms, target lang.
- Transcript lines are `[mm:ss] Tôi|Người khác (lang): text`. Use the text in the requested language
  (original if same language, else the stored translation; fall back to the original).
- Each mark (conclusion) is passed with the transcript window **90 s before / 15 s after** (constants
  `MARK_WINDOW_BEFORE_MS` / `MARK_WINDOW_AFTER_MS` in `@recap/core`; the web room highlight uses the same
  constants). The minutes generator can override them with env `MINUTES_MARK_WINDOW_BEFORE_MS` (5000-300000)
  and `MINUTES_MARK_WINDOW_AFTER_MS` (0-60000); blank = default. The prompt text states the configured numbers.
  The window never leaks across markers (only the MARKED CONCLUSIONS block is trimmed, the full TRANSCRIPT is
  untouched): "after" stops at the next marker (next conclusion mark or next topic marker); "before" stops at the
  previous topic marker (earlier lines belong to another topic). A previous conclusion mark is not a stop, so two
  consecutive conclusions may overlap. Segments straddling a window edge are kept whole (a segment that starts
  before a topic marker belongs to the earlier topic).
- Clock alignment: a mark's `atMs` is browser wall clock minus `clockOrigin` (= `ready` received - `baseMs`), segment
  times come from the audio clock. Measured with `tools/stream-file --mark-clock wall` (see README): offset is
  well below 0.3 s, negligible against the window.
  The LLM must output a decided conclusion for each mark and set `marked: true`; it may add unmarked ones.
- Long meetings: if transcript > ~12k tokens, map-reduce (chunk summaries → final), keep timestamps.
- OpenAI structured output (JSON schema derived from the zod schema), model from env `OPENAI_MINUTES_MODEL`
  (default `gpt-4.1`), temperature low. Never invent owners/dates not in the transcript (null instead).
- LLM behind an interface `MinutesLlm` with a `FakeMinutesLlm` for tests.

## Tasks
| Id | What | Depends |
|---|---|---|
| T7 | core schema + db migration/repo + `@recap/minutes` generator + REST (generate/get/put) | — |
| T8 | Web: end-of-meeting flow, minutes review/edit screen `/meetings/[id]/minutes` | T7 |
| T9 | `@recap/export` Word (.docx) VI / EN / bilingual + REST download | T7 |
| T10 | History: search (title + transcript, FTS5), filters, list improvements | T7 |
| T11 | Simple login (shared password or users table, signed cookie; WS guarded too) | T8–T10 |
| T12 | Post-meeting re-transcription of saved WAV (Deepgram pre-recorded, replaces segments, regenerates minutes) | T7 |

## REST (apps/web route handlers, same-origin guard like existing ones)
- `POST /api/meetings/:id/minutes` body `{ lang: "vi"|"en" }` → generate (or regenerate) and store, returns content.
- `GET /api/meetings/:id/minutes?lang=` → `{ content, source, generatedAt, updatedAt } | 404`.
- `PUT /api/meetings/:id/minutes` body `{ lang, content }` → validate with zod, store as `source: "edited"`.
- `GET /api/meetings/:id/export?lang=vi|en|both` → `.docx` download.
- `GET /api/meetings?q=&status=` → search.

# CLAUDE.md — Biên bản (meeting recap app)

Live bilingual (EN–VI) meeting recap: join Zoom/Teams **in the browser** → share the meeting tab + mic →
live transcript + live translation → minutes (topics, key points, decisions, action items) → review → Word export.
Owner: Viet Vu (Vietnamese, writes informal Vietnamese; **reply in Vietnamese**, UI copy in Vietnamese).

## Read first (source of truth lives in files, not in chat)
- `thoughts/ledgers/CONTINUITY_CLAUDE-recap-meeting.md` — current state + next steps (loaded at session start)
- `docs/PLAN.md` (roadmap + engineering rules) · `docs/ARCHITECTURE.md` (protocol §3, schema §4, auth §8)
- `docs/DESIGN.md` (Soft admin style, component/status rules, button placement) · `docs/UI-AUDIT.md`
- `docs/ADMIN.md` (usage REST, auth) · `docs/PHASE1.md` (minutes contract) · `docs/MORNING-CHECKLIST.md`
- `docs/REFERENCE-competitor-scan.md` — quét Foresight/Meetily/Anarlog + đề xuất nâng cấp/tính năng mới (chưa duyệt, chưa làm)
- `docs/REUSE-translation-ai.md` — reference project is **read-only**: `/Users/vietvu/Documents/NGHIEN CUU/AI/FULL_VIBER_CODE/COWORK-CLAUDE/translation-ai`

## Run
`npm run dev` (web :3000, realtime :4001) · `npm run verify` (test + typecheck + lint + prettier + check:deps; must be green)
First admin: `npm run create-admin -- --email <e> --name <n>` (password prompt, or env `RECAP_ADMIN_PASSWORD` for scripts).
Smoke: `npm run start -w @recap/tool-stream-file -- --file data/samples/david1-45s.wav --speed 4` (needs login token, see README).

## Stack / layout
npm workspaces, TypeScript strict. `apps/web` (Next 16, Tailwind 4, React 19), `apps/realtime` (Node `ws`), SQLite (better-sqlite3, WAL).
Packages: `core` (protocol/zod/constants), `db` (migrations + repos), `stt` (Deepgram adapter + segmenter), `translate` (Gemini → OpenAI fallback),
`minutes` (OpenAI minutes), `export` (docx), `auth`, `admin-ui` (reusable Soft UI kit — **the only UI component source**; no project knowledge inside).
STT: Deepgram first (server-side only), AssemblyAI plan B behind the adapter. Two audio channels: ch0 mic "Tôi", ch1 tab "Người khác".

## Hard rules (owner preferences — keep applying)
- **Never commit/push unless asked; use the `/commit` skill, never raw `git commit`.** Nothing has been committed yet.
- **Never publish anything online** (no Artifact tool) and **don't create files the owner didn't ask for** — local only.
- **Secrets:** `.env` holds real keys (reused from translation-ai, owner OK'd). Never print/log/echo key values, passwords or tokens; names/presence only.
  Browser must never receive a key. Don't write the owner's password anywhere.
- Use implementation **agents with model Sonnet** (token saving) for multi-file work; verify their output yourself (run `npm run verify`, look at screenshots).
- Observe before editing; plans/state go in files (ledger/PLAN), not memory.
- Code: files ≤300 lines, functions ≤50 (off only for admin-ui `.tsx` and tests), early returns, no magic numbers, every external service behind an interface, vitest tests.
- **DB migrations are immutable once applied** — add a new numbered migration (latest: 009). A test pins their checksums.
- Money/token/usage numbers live **only** on `/usage` (+ Settings pricing/budget), not on dashboard or lists.
- Amber is reserved for conclusions/decisions; no gradients except the Soft signature ones; no emoji; statuses via `apps/web/src/lib/status.ts`.
- Don't kill the owner's dev servers with `pkill`; check ports with `curl` first.

## Domain facts worth remembering
- Conclusion mark (key **K**) stores only a timestamp (`marks.at_ms`); minutes generation extracts transcript from **90 s before to 15 s after**
  the mark (stops at the next mark/topic marker; env `MINUTES_MARK_WINDOW_*`). Topic marker (key **T**) = hard topic boundary with optional label.
- Deepgram bills each channel separately (stereo = 2×); usage is shown as "giờ kênh". Prices in `config/pricing.json` (verified 2026-10-22 from official pages; re-check).
- Next dev worker may not inherit root `.env` → server code that needs keys loads it lazily via `@next/env` (see `apps/web/src/server/minutes-llm.ts`).
- Ended meetings are paged/virtualized in the room (`/api/meetings/:id/segments|segments/locate|search`).
- Vietnamese / mixed EN–VI STT quality is **unmeasured** — needs the owner's real recording + reference text (Phase 0 exit criteria).

## Open items (details in the ledger)
Owner real-meeting test (Win + Mac) · mixed EN–VI benchmark · long-meeting minutes (parallel chunks, progress, background) ·
"Đã chốt" over-assigned by the minutes prompt · T12 re-transcription · delete meeting · pause · dark theme · toast · glossary page.

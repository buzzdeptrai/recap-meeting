# CLAUDE.md — Biên bản (meeting recap app)

Live bilingual (EN–VI) meeting recap: join Zoom/Teams **in the browser** → share the meeting tab + mic →
live transcript + live translation → minutes (topics, key points, decisions, action items) → review → Word export.
Owner: Viet Vu (Vietnamese, writes informal Vietnamese; **reply in Vietnamese**, UI copy in Vietnamese).

## Read first (source of truth lives in files, not in chat)
- `thoughts/ledgers/CONTINUITY_CLAUDE-recap-meeting.md` — current state + next steps (loaded at session start)
- `docs/CHANGELOG.md` — lịch sử phát triển theo commit (quyết định + chưa kiểm chứng); đọc khi cần hiểu vì sao đã làm vậy
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

## Core architecture (read before changing the core; update this block when it changes — last review 2026-10-24)
- **Two long-running Node processes sharing one SQLite file (WAL):** `apps/web` (Next: pages + 22 REST route handlers, thin) and `apps/realtime`
  (`ws` audio/transcript socket **plus the background minutes worker**). Exactly **one realtime process per DB**; no horizontal scaling. At boot, before listening, realtime ends every meeting left `live` by a hard crash (`apps/realtime/src/boot-recovery.ts`, relies on this single-process rule).
  Needs a real VPS/disk (native better-sqlite3, AUDIO_DIR); not serverless. Deploy runbook: `docs/DEPLOY.md`, PM2 file `ecosystem.config.cjs`.
  Production uses `next start` on the full repo tree (**not** `output: "standalone"`: it drops `config/pricing.json` and `packages/db` repo-root lookup). `NEXT_PUBLIC_REALTIME_URL`
  is inlined at build time (set `wss://<domain>/ws` before `npm run build`). Realtime binds all interfaces unless `REALTIME_HOST` is set (PM2 production sets 127.0.0.1).
  Migrations run in `openDatabase()` on first open by any process (no cross-process lock; reload realtime first, wait for `/health`, then web).
- **Size (LOC, 2026-10-24):** web ~15.5k, admin-ui ~4.7k, backend packages ~8.7k, realtime ~1.8k → the FE is the bigger half (room UI is heavy), not a "small part".
- **Next is used thinly** (9 pages, `next/link|navigation|server`, `proxy.ts`, one font; almost no server components). Business logic lives in `packages/*`
  and `apps/web/src/server/*`; route handlers stay thin so a later move is cheap. **Option B (deferred, decide after measuring RAM/start time in prod):**
  Vite SPA + one Node API (Hono) merged with realtime, static FE behind Caddy. Do not start it without measurements and the owner's OK.
- **Minutes run in a worker inside realtime, never in the web process:** web only enqueues (`minutes_runs`, status queued|running|done|failed|cancelled, 202 + polling
  `GET .../minutes/run`); worker (`packages/minutes/src/worker/`, wired in `apps/realtime/src/minutes-worker.ts`) claims rows with a conditional UPDATE, writes progress,
  boot recovery marks leftover `running` rows failed (never requeues). Concurrency default 2; LLM calls retry 429/5xx with backoff (`packages/minutes/src/llm/retry.ts`); a queued run is only "unclaimed" when no worker activity is visible. Env: `MINUTES_WORKER_POLL_MS`, `MINUTES_WORKER_CONCURRENCY`, `MINUTES_QUEUED_CLAIM_TIMEOUT_MS`,
  `MINUTES_RUN_STALE_MS`. If realtime is down the UI shows "Đang chờ xử lý" then a failure. Map-reduce for long meetings is in `packages/minutes/src/generate.ts`.
  **Generate once, translate the rest (migration 012):** a generate run produces the SOURCE minutes (default `en`, owner picks per run); the worker then queues a `kind='translate'` run for the other language (`packages/minutes/src/translate*.ts`, model `OPENAI_MINUTES_TRANSLATE_MODEL`, default gpt-4.1-mini, usage `service=translate`). Derived rows carry `derived_from_lang` + `source_hash`; stale reason `source_edited`; hand-edited translations are overwritten only with explicit confirm (`confirmOverwrite`).
- **Stale minutes** are detected by version, not only timestamps: `minutes.prompt_version` (`PROMPT_VERSION` in `packages/minutes`; a test pins a hash of the prompts —
  bump it when `prompts.ts` changes), model, `marks_fingerprint` + `notes_fingerprint` → typed reasons (`transcript_changed|marks_changed|marks_removed|notes_changed|prompt_updated|model_changed`).
  The meetings-list stale badge is still timestamp-only (marks and transcript; hand notes are not in the SQL predicate).
- **STT silence gate (AssemblyAI only):** a channel silent for `STT_IDLE_AFTER_MS` (default 30000, 0 disables) stops sending audio to STT; 1.5 s pre-roll on resume; usage counts frames actually sent (`stt.usage`). Deepgram is untouched (stereo, 2x billing). Thresholds 0.005/0.012 are guesses. Client side: mic/tab silence + speaker-echo banners, mic picker/hot-swap in `apps/web/src/audio/`.
- **Realtime robustness (2026-10-30):** errors inside one session are caught per session (`MeetingSession.fail`), not process-wide; server ping + terminate dead sockets; same-user takeover of a session (`SESSION_REPLACED`); `REALTIME_MAX_CONNECTIONS` (40); slow-client backpressure (`apps/realtime/src/backpressure.ts`). Spec in `docs/ARCHITECTURE.md` §3.
- **Prompts:** transcript is wrapped in `<transcript>` tags and escaped (anti prompt-injection); Vietnamese output keeps English technical terms.
- **Realtime protocol additions:** client `stt_retry` (restarts the STT provider when status `closed`; errors `NOT_RECORDING|STT_ALREADY_OPEN|RATE_LIMITED`; audio sent while
  closed is not re-sent to STT, only kept in the WAV). Spec in `docs/ARCHITECTURE.md` §3.
- **UI kit `@recap/admin-ui` v0.2.2 ("Soft v2"):** brand colour is **blue** (`--soft-brand`; `purple` names are deprecated aliases), floating cards + tonal secondary buttons +
  solid-brand selected states. Room = transcript turns (header only on a new speaker/gap > 30 s), density Gọn/Thoải mái, conclusions are **divider rows** (not per-segment tint),
  topic markers likewise. Row heights are measured constants pinned in `virtual-rows.test.ts` — re-measure if row markup changes. Static look reference: `design/room-preview-v1/`.
- **Hand notes (B1, `meeting_notes`, REST `/api/meetings/:id/notes`, room tab "Ghi chú"):** stored apart from AI output; minutes get them as an escaped `<notes>` block (PROMPT_VERSION 5) = owner-confirmed key points, additive only (never drop a topic), never proof of a decision. Notes can be added by selecting transcript text (floating "Thêm vào ghi chú", `selection-note*.ts`).
- **Marks vs minutes (two different sources):** the room's counts come from hand marks only (`marks`: T topic marker, K conclusion = timestamp). Minutes (AI) topics/conclusions appear in the room only as "Gợi ý từ biên bản" (`minutes-suggestions.ts`, dedupe window 30 s, `marked:true` hidden, `marked:false` chip "AI đề xuất", never amber). Topic outcome labels: Đã thống nhất / Còn bỏ ngỏ / Đã loại (values `decided|open|rejected`).
- **Local `.env` uses `STT_PROVIDER=assemblyai`** (code default is deepgram); live sessions ran AssemblyAI.
- **Reference scan of Foresight / Meetily / Anarlog + backlog (A = upgrades, B = new features):** `docs/REFERENCE-competitor-scan.md`. Done so far: A1, A2, A3, A4, A5, A8; B1 first slice (hand notes tab + minutes must-keep signal).

## Hard rules (owner preferences — keep applying)
- **Before every commit (via `/commit`): add an entry on top of `docs/CHANGELOG.md` (what + why, decisions, unverified) and update the "Core architecture" / "Open items" blocks here if they changed; include these files in the same commit.**
- **Never commit/push unless asked; use the `/commit` skill, never raw `git commit`.** Remote `origin` = `github.com/buzzdeptrai/recap-meeting` (branch `main`).
  Keep `ptg-meeting-note.jpg` (owner's personal note) out of git unless told otherwise.
- **Never publish anything online** (no Artifact tool) and **don't create files the owner didn't ask for** — local only.
- **Secrets:** `.env` holds real keys (reused from translation-ai, owner OK'd). Never print/log/echo key values, passwords or tokens; names/presence only.
  Browser must never receive a key. Don't write the owner's password anywhere.
- Use implementation **agents with model Sonnet** (token saving) for multi-file work; verify their output yourself (run `npm run verify`, look at screenshots).
- Observe before editing; plans/state go in files (ledger/PLAN), not memory.
- Code: files ≤300 lines, functions ≤50 (off only for admin-ui `.tsx` and tests), early returns, no magic numbers, every external service behind an interface, vitest tests.
- **DB migrations are immutable once applied** — add a new numbered migration (latest: 013 hand notes `meeting_notes` + `minutes.notes_fingerprint`; 012 minutes translation; 011 = soft delete `meetings.deleted_at`: filter every meetings query on it; `meetings.get()` hides deleted rows). A test pins their checksums.
- Money/token/usage numbers live **only** on `/usage` (+ Settings pricing/budget), not on dashboard or lists.
- Amber is reserved for conclusions/decisions; no gradients except the Soft signature ones; no emoji; statuses via `apps/web/src/lib/status.ts`.
- Don't kill the owner's dev servers with `pkill`; check ports with `curl` first.

## Domain facts worth remembering
- Conclusion mark (key **K**) stores only a timestamp (`marks.at_ms`); minutes generation extracts transcript from **90 s before to 15 s after**
  the mark (stops at the next mark/topic marker; env `MINUTES_MARK_WINDOW_*`). Topic marker (key **T**) = hard topic boundary with optional label.
- Deepgram bills each channel separately (stereo = 2×); usage is shown as "giờ kênh". Prices in `config/pricing.json` (verified 2026-10-22 from official pages; re-check).
- Next dev worker may not inherit root `.env` → server code that needs keys loads it lazily via `@next/env` (see `apps/web/src/server/minutes-model.ts`). Realtime loads the root `.env` itself.
- Node fetch (so the OpenAI SDK) refuses port 4190 — use another port for fake servers in tests.
- Ended meetings are paged/virtualized in the room (`/api/meetings/:id/segments|segments/locate|search`).
- Vietnamese / mixed EN–VI STT quality is **unmeasured** — needs the owner's real recording + reference text (Phase 0 exit criteria).

## Open items (details in the ledger)
Owner real-meeting test (Win + Mac) · tune silence/echo thresholds · transcript echo dedupe (deferred until real data) · Deepgram per-channel saving needs two mono sockets · purge/hard delete of soft-deleted meetings (needs audio-file policy) · mixed EN–VI benchmark · "Đã thống nhất" (was "Đã chốt") over-assigned by the minutes prompt (idea: typed notes as must-keep signal, B1) ·
T12 re-transcription · delete meeting · pause · toast · glossary page · per-meeting keyterm priority (Deepgram cap 30 terms) ·
B1 follow-ups (note timestamp picker in ended meetings, notes in the Word export, notes in the list stale badge, AI "expand" of notes) / B2 minutes templates / B3+ Q&A from documents · rename speakers · word-level storage ·
**unverified live:** new room recording/draft states + dark mode, STT retry against real Deepgram/AssemblyAI, minutes progress with the real LLM, touch-device gutter times.
(Long-meeting background minutes + progress: **done** 2026-10-24.)

# Architecture

## 1. Overview

```
Browser (apps/web, Next.js)
  getDisplayMedia (meeting tab audio) ─┐
  getUserMedia (mic) ──────────────────┴─► AudioWorklet → 16 kHz Int16 stereo (ch0 mic, ch1 tab)
        │                                   │ WS binary frames, 100 ms each
        ▼                                   ▼
  UI ◄── JSON events ──────────── apps/realtime (Node, ws, port 4001)
                                     ├─ MeetingSession (one per active meeting)
                                     │   ├─ AudioWriter → data/audio/<id>.wav
                                     │   ├─ SttProvider (packages/stt) ──► Deepgram (server-side key)
                                     │   ├─ Segmenter (per channel) → final segments
                                     │   └─ Translator (packages/translate) ──► Gemini → OpenAI fallback
                                     └─ Repositories (packages/db) ──► SQLite data/recap.db
apps/web REST (route handlers) ──► packages/db  (meetings CRUD, history)
```

Both processes open the same SQLite file (WAL mode allows one writer + many readers).
Realtime is the only writer for segments/translations/marks during a live meeting.

## 2. Repository layout

```
RECAP-MEETING/
├─ apps/
│  ├─ web/                 Next.js App Router, Tailwind, UI + REST route handlers
│  │  ├─ src/app/          routes: /, /meetings/new, /meetings/[id], /api/meetings/...
│  │  ├─ src/components/ui primitives (design system)
│  │  ├─ src/features/     meeting-list/, meeting-room/ (transcript, controls, rail)
│  │  ├─ src/audio/        capture.ts, worklet (public/worklets/pcm-encoder.js), levels.ts
│  │  └─ src/lib/          ws-client.ts, api.ts, format.ts
│  └─ realtime/
│     └─ src/              server.ts, session/, audio/, env.ts
├─ packages/
│  ├─ core/       protocol types + zod schemas, constants (sample rate, frame size, channels)
│  ├─ db/         sqlite connection, migrations/, repositories/
│  ├─ stt/        SttProvider interface, deepgram/, fake/, segmenter/
│  ├─ translate/  router, circuit-breaker, providers/{gemini,openai,fake}, prompts, glossary, context
│  └─ minutes/    (Phase 1)
├─ tools/         stream-file/, bench/
├─ data/          recap.db, audio/   (gitignored)
├─ docs/          PLAN.md, ARCHITECTURE.md, DESIGN.md, REUSE-translation-ai.md
└─ thoughts/ledgers/CONTINUITY_CLAUDE-recap-meeting.md
```

Package names: `@recap/core`, `@recap/db`, `@recap/stt`, `@recap/translate`, `@recap/minutes`, `@recap/auth`.
Packages are consumed as TypeScript source (no build step): `"main": "src/index.ts"`, Next uses
`transpilePackages`, realtime runs with `tsx`.

## 3. WebSocket protocol (packages/core) — the contract between T2 and T4

URL: `ws://localhost:4001/ws` (configurable `NEXT_PUBLIC_REALTIME_URL`).
All times are **ms since meeting start** (`startMs`, `endMs`, `atMs`).
Channel: `0` = mic ("Tôi"), `1` = meeting tab ("Người khác").

### Client → server
JSON text frames:
```ts
{ type: "start", meetingId: string, sourceLang: "auto" | "vi" | "en" | "multi", targetLang: "vi" | "en", resume?: boolean }
{ type: "mark", kind: "conclusion" | "topic", atMs: number, label?: string /* max 120 */ }
{ type: "unmark", id: string }                         // delete a mark
{ type: "mark_label", id: string, label: string }      // rename; "" clears
{ type: "stt_retry" }                                  // restart the STT provider after it gave up (status "closed")
{ type: "stop" }
{ type: "ping", t: number }
```
Binary frames (only after `ready`): raw PCM **Int16 little-endian, interleaved stereo, 16000 Hz**,
100 ms per frame = 1600 frames × 2 ch × 2 bytes = 6400 bytes.

### Server → client
```ts
{ type: "ready", meetingId: string, startedAt: string /* ISO */, baseMs?: number /* audio already recorded; >0 when resuming */ }
{ type: "status", stt: "connecting" | "open" | "reconnecting" | "closed", translate: { provider: string | null, degraded: boolean } }
{ type: "interim", channel: 0 | 1, text: string, startMs: number, endMs: number }
{ type: "segment", segment: { id: string, seq: number, channel: 0 | 1, lang: string | null, startMs: number, endMs: number, text: string } }
{ type: "translation", segmentId: string, seq: number, lang: "vi" | "en", text: string, provider: string, latencyMs: number }
{ type: "mark", mark: { id: string, kind: "conclusion" | "topic", atMs: number, label: string | null } }  // same id = upsert (rename)
{ type: "unmark", id: string }
{ type: "error", code: "STT_UNAVAILABLE" | "BAD_MESSAGE" | "MEETING_NOT_FOUND" | "TRANSLATE_FAILED" | "INTERNAL" | "NOT_RECORDING" | "STT_ALREADY_OPEN" | "RATE_LIMITED", message: string, segmentId?: string }
{ type: "pong", t: number }
{ type: "stopped", meetingId: string }
```
Topic markers (`kind:"topic"`) are hard topic boundaries for the minutes. Mark edits need a live session over the socket; ended meetings use REST `PATCH|DELETE /api/meetings/:id/marks/:markId`.
Resuming (`start` with `resume:true`) is allowed for ended meetings: status goes back to `live`, `started_at` is kept, `ended_at`/`duration_ms` are cleared until the next end, and `duration_ms` on end = total recorded audio (all runs).
`seq` is monotonically increasing per meeting across both channels (ordering key).
`stt_retry`: only acts while the session is live and `status.stt` is `closed` (provider gave up after its 8 reconnect attempts, or never connected). The server calls `SttProvider.open()` again (same instance, same factory, no key leaves the server) and answers with `status` updates (`connecting` → `open`, or back to `closed` on failure; no error event on a failed attempt). Refusals: `NOT_RECORDING` (no live session), `STT_ALREADY_OPEN` (already connecting/open; a `status` is re-sent so the client resyncs), `RATE_LIMITED` (min 3 s between attempts, max 20 per session). Audio sent while the provider was `closed` is dropped (not replayed; it stays in the WAV); audio sent while the retry is connecting is buffered by the provider and replayed on success. Usage is metered by the one per-session meter: closed-time frames are not counted, frames buffered during a retry only if it connects.
**STT silence gating (AssemblyAI only, env `STT_IDLE_AFTER_MS`, default 30000, `0` = off).** Each channel has a pure gate (`packages/stt/src/silence-gate.ts`, RMS per 100 ms frame; sleep level 0.005, wake level 0.012 for hysteresis). After the idle window of continuous silence the channel's socket gets `Terminate` and is closed (no reconnect, `status.stt` stays `open`; idle channels are left out of the merged status, both idle = `open`). The next frame above the wake level reopens the socket (existing backoff; the per-minute session-start limit retries with a 5 s floor) and the last 1.5 s (pre-roll ring) is sent first; timestamps are anchored to the first flushed frame, so segments land on the right place of the meeting timeline. The WAV still gets every frame. Usage is billed from what was actually sent (`SttProvider.usage.takeSentChannelFrames()`); providers without that hook (Deepgram, fake) bill every frame on both channels as before. No protocol change: idle/wake transitions are only logged (`[session] <meetingId> STT channel <n> idle|active`, no audio, no keys). **Deepgram is deliberately untouched:** one stereo socket bills both channels together, so per-channel savings would need two mono sockets (not done); keeping the socket open and sending nothing while both channels are silent was rejected as too little gain for the added risk of changing the stereo timeline.
Every message is validated with zod on both sides; invalid → `error BAD_MESSAGE`.

## 4. Database (SQLite, packages/db)

```sql
meetings(id TEXT PK, title TEXT NOT NULL, status TEXT CHECK(status IN ('draft','live','ended')),
         source_lang TEXT, target_lang TEXT, agenda TEXT,
         created_at TEXT, started_at TEXT, ended_at TEXT, duration_ms INTEGER)
segments(id TEXT PK, meeting_id TEXT FK, seq INTEGER, channel INTEGER, lang TEXT,
         start_ms INTEGER, end_ms INTEGER, text TEXT, created_at TEXT, UNIQUE(meeting_id, seq))
translations(segment_id TEXT FK, lang TEXT, text TEXT, provider TEXT, latency_ms INTEGER,
             created_at TEXT, PRIMARY KEY(segment_id, lang))
marks(id TEXT PK, meeting_id TEXT FK, kind TEXT /* conclusion|topic */, at_ms INTEGER, created_at TEXT,
      label TEXT NULL /* migration 006 */, updated_at TEXT NULL /* migration 007 */)
glossary_terms(id TEXT PK, term TEXT, lang TEXT, translation TEXT, do_not_translate INTEGER,
               priority INTEGER, created_at TEXT)
term_variants(id TEXT PK, term_id TEXT FK, variant TEXT)
schema_migrations(version INTEGER PK, applied_at TEXT)
users(id TEXT PK, email TEXT UNIQUE /* lowercased */, name, role CHECK IN ('admin','member'), password_hash,
      disabled INTEGER, created_at, last_login_at)               -- migration 008
sessions(id TEXT PK /* 32 random bytes, base64url */, user_id FK ON DELETE CASCADE, created_at, expires_at,
         last_seen_at, user_agent)                                 -- migration 008
```
Applied migrations are immutable (checksums pinned in `packages/db/test/migration-checksums.test.ts`); the runner applies any missing version in order, so gaps in numbering are safe.
### Long transcripts: paged REST (no migration; uses the `(meeting_id, seq)` unique index and `segments_fts` / `translations_fts`)
All behind `withAuth` (401 without a session, 404 for an unknown meeting, 400 on bad query).
- `GET /api/meetings/:id` -> `{ meeting, marks (all), markAnchors{markId -> {id,seq,startMs,text}}, stats{segments,words,translated}, page }`; `page` is ONE `SegmentsPageDto` (~200 rows): the head for an ended meeting, the tail for a `live` one. The room page uses `?t=<ms>` to open the page around that time.
- `GET /api/meetings/:id/segments?from=<seq>&limit=<1..500, default 200, clamped>&dir=forward|backward` -> `{ segments (ascending), translations (only those segments'), nextCursor, prevCursor, total }`. Forward: `from` is inclusive (default = first). Backward: segments strictly before `from` (default = the end). `nextCursor` = `from` for the next forward page (null at the end); `prevCursor` = `from` for the next backward page (null at the start).
- `GET /api/meetings/:id/segments/locate?atMs=<ms>|seq=<n>[&limit=]` -> `{ segmentId, seq, startMs, from }`: the segment spanning (else nearest to) the time, and a forward cursor leaving half a page before it. 404 `SEGMENT_NOT_FOUND` when the meeting has no segments.
- `GET /api/meetings/:id/search?q=&limit=<default 200, max 500>` -> `{ hits:[{segmentId,seq,startMs,snippet(escaped, <mark>),source:"text"|"translation"}], truncated, terms }`. Same sanitizer / diacritics folding as the list search (`buildFtsQuery`); one hit per segment, ordered by seq; blank `q` -> no hits.
Client: `@tanstack/react-virtual` 3.14.21 (MIT) virtualizes the list; pages are fetched when the viewport is within 60 rows of the loaded edge, de-duplicated per (dir, cursor) and applied only if the window still awaits that cursor (`page-loaded` / `window-replaced` in `features/meeting-room/state.ts`). Live segments append only while the window is the tail (otherwise held in `pendingLive`). No eviction: 8,000 plain rows stay small (see UI-AUDIT numbers).

Minutes REST `GET` returns `stale: boolean` (transcript or marks changed after `generatedAt`).
IDs: `crypto.randomUUID()`. Timestamps: ISO strings. Repositories expose typed functions only;
no SQL outside `packages/db`. Driver: `better-sqlite3`; if it fails to build on Node 25 use
`node:sqlite` behind the same interface (document the choice in the ledger).

### Background minutes worker (no migration; table `minutes_runs` from migration 010)
The model never runs inside the Next.js process. `POST /api/meetings/:id/minutes` keeps auth, same-origin, validation and the synchronous preconditions (404 / 409 / 422 / 503), inserts a `queued` run (idempotent per meeting + language) and answers 202 with the run DTO. A worker inside the long-lived `apps/realtime` process executes it; the UI reads `GET .../minutes/run`. Code: orchestration in `packages/minutes/src/worker/` (interfaces `RunStore`, `MinutesStore`, `LlmFactory`, `UsageSink`; no app imports), wiring in `apps/realtime/src/minutes-worker.ts`, enqueue/read in `apps/web/src/server/minutes-run-service.ts`. Web and realtime talk only through the SQLite file.
| Status | Written by | Meaning |
|---|---|---|
| `queued` | web (enqueue) | waiting for the worker; unclaimed for `MINUTES_QUEUED_CLAIM_TIMEOUT_MS` -> `failed` lazily on read ("Dịch vụ xử lý nền chưa chạy. Hãy thử lại sau.") |
| `running` | worker (claim) | claimed by one conditional `UPDATE ... WHERE status='queued' ... RETURNING` (two workers/processes never get the same row); progress (`phase` map/reduce/finalize, `done_chunks/total_chunks`) written per step |
| `done` | worker | minutes stored (`prompt_version`, `model`, `marks_fingerprint`), `usage_events` written once per model call |
| `failed` | worker / web / recovery | safe Vietnamese message only (never keys, prompts, transcript); also: not updated for `MINUTES_RUN_STALE_MS` (lazy, on read); `running` at realtime boot or shutdown -> "Máy chủ khởi động lại khi đang tạo biên bản. Hãy thử lại." (never auto-requeued) |
| `cancelled` | (unused by the UI) | terminal |
Worker loop: poll every `MINUTES_WORKER_POLL_MS`, at most `MINUTES_WORKER_CONCURRENCY` runs at once. A `finally` guard fails any row still active when its job ends. Startup recovery assumes ONE realtime process per database (a second process booting would fail the first one's running runs; a claim-owner column would need migration 011). `SIGTERM/SIGINT`: stop polling, fail in-flight runs with the restart message, close (hard timeout 5 s). `GET /health` on realtime adds `minutesWorker: {running, pollMs}`; the log line `minutes worker started` is printed at boot. Metering: the worker records `usage_events` (vendor openai, service minutes) through the same recorder as translation.

### Minutes translation (migration 012)
Minutes are generated ONCE, in a source language (default English; the owner picks English or Vietnamese when generating). The other language is derived by translation, never by a second map-reduce.
- Schema: `minutes.derived_from_lang` (NULL = source row; all rows from before 012 stay source rows), `minutes.source_hash` (sha256 of the source content that was translated), `minutes_runs.kind` (`generate` default | `translate`; for `translate`, `lang` is the TARGET language), `minutes_runs.overwrite` (the user confirmed replacing a hand-edited translation). The partial unique index on active runs stays per (meeting, lang): generating a language while it is being translated (or the reverse) is a 409 `RUN_BUSY`.
- Pipeline: the worker stores the source minutes, queues a `translate` run for the other language in the same queue (before marking the source run `done`, so the UI sees it at once), then marks the source `done`. Source minutes are usable immediately; a translation failure leaves the source untouched and the run shows a safe Vietnamese error ("Không dịch được biên bản...") with a retry. Queuing is skipped when the worker has no `createTranslateLlm`, or when the other language holds a hand-edited (`source='edited'`) version.
- Translation (`packages/minutes/src/translate*.ts`): one small call through the `MinutesLlm` interface (default model `OPENAI_MINUTES_TRANSLATE_MODEL`, `gpt-4.1-mini`, already priced as openai/translate). Only prose is sent (summary, topic titles, key points, conclusions, action tasks and due text, open issues) as JSON inside `<minutes_json>` tags (`<` escaped as `\u003c`, so text cannot close the data block); ids, `atMs`, statuses, `marked` flags and owners are copied from the source by position, never by the model. Glossary lines as in generation; Vietnamese output keeps English technical terms. The reply is checked (same counts, same nulls) and validated with the minutes zod schema; one retry, then `INVALID_OUTPUT`.
- Staleness: a derived row is stale only with reason `source_edited` (its stored `source_hash` differs from the hash of the current source content: the source was edited or regenerated). Transcript/marks/prompt/model reasons are reported on the source row only. Editing a translation keeps `derived_from_lang`/`source_hash` and never touches the source.
- Overwrite protection: `POST /api/meetings/:id/minutes/translate {lang, confirmOverwrite?}` answers 409 `DERIVED_EDITED` for a `source='edited'` target unless `confirmOverwrite: true`; the worker enforces the same rule from `minutes_runs.overwrite`; automatic re-translation after regenerating the source skips a hand-edited translation (the UI offers "Dịch lại" with a confirm).
- Metering: translation calls are `usage_events` with vendor openai, service `translate`, `meta.kind = "minutes"`; priced by the existing `openai/translate/gpt-4.1-mini` entry. Shown on `/usage` only.

## 5. Configuration (.env at repo root)
```
DEEPGRAM_API_KEY=            # required
OPENAI_API_KEY=              # required (fallback translation, minutes)
GEMINI_API_KEY=              # required (primary translation)
ASSEMBLYAI_API_KEY=          # optional (plan B STT)
DEEPGRAM_MODEL=nova-3
DEEPGRAM_LANGUAGE=multi      # vi | en | multi — tuned in Phase 0 bench
GEMINI_MODEL=gemini-3.1-flash-lite
OPENAI_TRANSLATE_MODEL=gpt-4.1-mini
TRANSLATE_PROVIDER_ORDER=gemini,openai
TRANSLATE_DEADLINE_MS=1500
REALTIME_PORT=4001
# REALTIME_HOST=127.0.0.1   # optional; unset = all interfaces (dev), production = loopback only
NEXT_PUBLIC_REALTIME_URL=ws://localhost:4001/ws
DB_PATH=./data/recap.db
AUDIO_DIR=./data/audio
OPENAI_MINUTES_TRANSLATE_MODEL=gpt-4.1-mini   # optional; model that translates finished minutes
OPENAI_MINUTES_MODEL=gpt-4.1   # read by the realtime minutes worker (and by web for the 503 check / stale-by-model)
MINUTES_WORKER_POLL_MS=1000
MINUTES_WORKER_CONCURRENCY=1
MINUTES_QUEUED_CLAIM_TIMEOUT_MS=120000   # web: queued run nobody claimed -> failed
MINUTES_RUN_STALE_MS=600000              # web: queued/running run not updated -> failed
```
Env is validated at startup with zod (`apps/realtime/src/env.ts`); missing required key → clear error.

## 6. Dependencies (installed by T1 so later agents never run npm install)
- root dev: typescript, tsx, vitest, eslint, @typescript-eslint/*, prettier, concurrently
- core: zod
- db: better-sqlite3 (+ @types/better-sqlite3)
- stt: ws (+ @types/ws)
- translate: openai, @google/genai
- realtime: ws, dotenv, zod
- web: next, react, react-dom, tailwindcss (+ @tailwindcss/postcss), @radix-ui/react-dialog,
  @radix-ui/react-tooltip, @phosphor-icons/react, clsx
- tools: (ffmpeg is a system binary; check with `which ffmpeg`)

## 7. Key decisions
- Deepgram `multichannel=true, channels=2` → per-channel transcripts = cheap "Tôi / Người khác".
- Segmenting happens server-side (single place, testable), not in the browser.
- Translation is per final segment, with 3-segment context, strictly ordered by `seq`.
- Browser never sees any API key (fix of translation-ai `GET /api/deepgram-key`).
- Audio saved during the meeting so Phase 1 can re-transcribe with a more accurate batch model.

## 8. Auth (T11 / C1)
Single-tenant, roles `admin` | `member`. Code: `packages/auth` (`@recap/auth`, node:crypto only), tables in §4.
- **Passwords**: scrypt (N=32768, r=8, p=1), stored as `scrypt$N$r$p$salt$hash`; parameters are read back from the hash (so they can be raised later; `needsRehash`). Verification is constant-time; unknown users pay one dummy scrypt; the policy is min 10 characters.
- **Session**: random 32-byte id in `sessions`; cookie `recap_session = <id>.<HMAC-SHA256(id)>` signed with `AUTH_SECRET` (>= 32 chars). Without it: development generates `data/.auth-secret` (0600, created atomically, shared by web, realtime and the CLI, with a warning); production refuses to start. Cookie: HttpOnly, SameSite=Lax, Path=/, `Secure` over https, session cookie unless "remember" (30 days).
- **Lifetime**: sliding 7 days (rewritten at most every 5 min), absolute 30 days. Disabling a user, resetting a password or deleting the row kills the session; a password change keeps only the current session.
- **Brute force**: in memory, 5 failures per IP+email (and 20 per email across IPs) lock for 15 min (`429 LOCKED`, `Retry-After`); generic message for unknown email, wrong password and disabled user. The client IP comes from `X-Forwarded-For` only when `AUTH_TRUST_PROXY=true`; otherwise all clients share one bucket, which effectively limits per email. The limiter resets when the web server restarts.
- **Two layers (web)**: `src/proxy.ts` (Next 16 name for middleware, Node runtime) only verifies the cookie signature (no database): unauthenticated pages redirect to `/login?next=<path>` (relative paths only, `lib/safe-redirect.ts`), `/api/*` returns 401 `{error:{code:"UNAUTHENTICATED"}}`. Public: `/login`, `/api/auth/login`, `/api/auth/logout`, `/_next`, static files, `/worklets/*`. The real check (session row, expiry, user enabled) is `requireUser`/`requireAdmin` (`server/auth.ts`); every API route is wrapped as `export const GET = withAuth(...)` (`{ admin: true }` for `/api/users`), and a test fails if a route forgets it. Pages/layouts use `getCurrentUser`/`requirePageUser`/`requirePageAdmin` (`server/auth-page.ts`).
- **API**: `POST /api/auth/login {email,password,remember}` -> 200 `{user}` + cookie / 401 `INVALID_CREDENTIALS` / 429 `LOCKED`; `POST /api/auth/logout` (idempotent); `GET /api/auth/me`; `POST /api/auth/change-password {currentPassword,newPassword}`; admin: `GET|POST /api/users`, `PATCH /api/users/:id {name,role,disabled,resetPassword}` (reset and create-without-password return a one-time `tempPassword`; you cannot disable or demote yourself or the last enabled admin). Writes are protected by the same-origin guard.
- **Realtime**: the WS upgrade checks the origin allow-list, then the cookie (signature, then the session in the shared SQLite file) and answers `401` before upgrading. Cookies are scoped by host, not port, so the cookie set by `localhost:3000` is also sent to `localhost:4001` (verified with a direct probe; a real browser run is still to be checked). The session is checked at connect time only: disabling a user does not cut a meeting already in progress.
- **Service token**: optional `RECAP_SERVICE_TOKEN` (>= 16 chars) accepted as `Authorization: Bearer` on the WS upgrade only (compared in constant time) for `tools/stream-file`; unset = disabled. It grants no web access.
- **First admin**: `npm run create-admin -- --email <e> --name <n>` (password prompt without echo; `RECAP_ADMIN_PASSWORD` for non-interactive use). It also promotes, re-enables and re-passwords an existing user.

# Meeting Recap — Master Plan

> Single source of truth for the roadmap. Update checkboxes as work completes.
> Read together with: `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/REUSE-translation-ai.md`,
> and the ledger `thoughts/ledgers/CONTINUITY_CLAUDE-recap-meeting.md`.

## Product in one line
Join Zoom/Teams **in the browser** → share the meeting tab + mic → live transcript with live
EN↔VI translation → after the meeting, minutes (topics, key points, decisions, action items)
in both languages → review → export Word.

Target users: SME / teams in Vietnam who meet with foreign partners (mixed EN–VI meetings).

## Locked decisions (2026-10-21)
| Area | Decision |
|---|---|
| Stack | npm workspaces monorepo, TypeScript everywhere. `apps/web` = Next.js (App Router). `apps/realtime` = Node WebSocket server |
| Browsers | Chrome + Edge, Windows + Mac. V1 supports meetings joined via the **web** version of Zoom/Teams only |
| STT | Adapter interface; **Deepgram first** (server-side proxy, key never sent to browser). AssemblyAI = plan B |
| Translation | Gemini primary, OpenAI GPT fallback (router + circuit breaker ported from translation-ai) |
| Minutes LLM | OpenAI GPT (Phase 1) |
| DB | SQLite (WAL) for Phase 0–1; repository layer so Postgres can replace it later |
| Audio | 2 channels kept separate: ch0 = mic ("Tôi"), ch1 = meeting tab ("Người khác"). 16 kHz linear16 |
| UI | Custom, professional, NOT generic-AI look — see `docs/DESIGN.md` |
| Secrets | `.env` at repo root (gitignored). Never printed, never sent to the browser |

## Engineering rules (all agents)
- TypeScript strict. Files ≤ 300 lines, functions ≤ 50 lines, early returns, no magic numbers (constants/config).
- Each package has one responsibility; apps only compose packages.
- Unit tests (vitest) for every package with logic (chunker, router, protocol, db repos).
- Every external service behind an interface (STT, translator, LLM) so it can be swapped / faked in tests.
- No `git commit`, no publishing anything online. Local files only.
- Never print or log API key values.
- When a task finishes: tick its checkbox here, append a short note to the ledger "Done" list.

---

## Phase 0 — Technical proof (current)

### Batch A — foundation (sequential, must finish first)
- [x] **T1 Scaffold** — monorepo, tooling, shared protocol types, db package, env, scripts
  - root `package.json` workspaces, `tsconfig.base.json`, eslint + prettier, vitest
  - `packages/core`: WS protocol types + zod schemas (exactly as `ARCHITECTURE.md §3`), shared constants
  - `packages/db`: SQLite connection (WAL), migrations runner, schema from `ARCHITECTURE.md §4`, repositories (meetings, segments, translations, marks, glossary) + tests
  - `apps/web`: Next.js + Tailwind skeleton with design tokens from `DESIGN.md` (fonts, colors, light/dark) — empty pages only
  - `apps/realtime`: Node TS skeleton (tsx watch), health endpoint, env loading + validation
  - Pre-install ALL deps needed by later tasks (list in `ARCHITECTURE.md §6`) so parallel agents never run `npm install`
  - `npm run dev` starts web (3000) + realtime (4001); `npm test` runs all tests; `npm run typecheck`

### Batch B — parallel (after T1)
- [x] **T2 Realtime + STT** (`apps/realtime`, `packages/stt`)
  - `SttProvider` interface + `DeepgramProvider` (raw `ws` to Deepgram, multichannel, interim, endpointing, utterance_end, keyterms, KeepAlive, reconnect with backoff + audio buffer during reconnect)
  - `FakeSttProvider` for tests
  - WS session handler: protocol §3, per-meeting session, writes audio to `data/audio/<meetingId>.wav`, segmenter → persist segments → emit events
  - Segmenter = port of translation-ai `stt-processor.js` + `chunker.js` cut rules (silence / semantic / hard cap), per channel
  - Tests: segmenter rules, session flow with fake STT
- [x] **T3 Translation** (`packages/translate`)
  - Port: `dictionary-matcher`, `circuit-breaker`, `translation-router`, providers (gemini, openai) with deadline/AbortController, prompts (filler/disfluency rules)
  - FIX vs translation-ai: context buffer actually populated (last 3 source+translation pairs per meeting), strict ordering by `seq`, glossary for both EN and VI
  - Public API: `createTranslator(config).translate({meetingId, seq, text, sourceLang, targetLang}) → {text, provider, latencyMs}`
  - Tests with fake providers: failover, breaker trip/recover, ordering, context, glossary injection
- [x] **T4 Web UI** (`apps/web`)
  - Design system primitives per `DESIGN.md` (Button, IconButton, Pill, SegmentedControl, Meter, Banner, Kbd, EmptyState)
  - Pages: meeting list `/`, new meeting `/meetings/new`, room `/meetings/[id]`
  - Audio capture: `getDisplayMedia` (tab audio) + `getUserMedia` (mic) → AudioWorklet → 16 kHz Int16 interleaved stereo frames (100 ms) → WS
  - Missing-audio detection + warning banner; per-channel level meters
  - Transcript view (interim + final, translation under each line, view toggle), "Đánh dấu kết luận" button (shortcut K), status rail
  - Uses mock WS server mode when realtime is down? No — just shows clear "Không kết nối được máy chủ" state

### Batch C — integration (after B)
- [x] **T5 Wire-up + E2E**
  - Realtime: segments → translator → `translation` events + persist
  - `tools/stream-file`: stream an audio file (ffmpeg → 16k stereo PCM) through the WS as a fake client → prints transcript + translations (smoke test with translation-ai SONG-TEST clips)
  - `tools/bench`: STT benchmark harness (port idea of `compare-stt-stream.js`) computing WER vs reference `.txt`, configs: language `vi`, `en`, `multi`, detect
- [x] **T6 Review + hardening**
  - Full code review vs these rules, fix issues, all tests + typecheck + lint green
  - README with run instructions (Vietnamese), update ledger
  - T6a segmenter quality done (dependent-word guard, sentence-first cuts, re-tuned thresholds)
  - T6b hardening done (deps declared + `check:deps`, fallback deadline, WS origin/size/rate limits, race fixes, root README, `npm run verify`)

### Phase 0 exit criteria (needs the user)
- [ ] Live test with a real Zoom/Teams web meeting on Windows + Mac
- [ ] Benchmark 2–3 real mixed EN–VI meeting recordings (user provides audio + reference text)
- [ ] Decision: Deepgram good enough for VI / mixed? If not → switch provider via adapter

## Phase 1 — Internal MVP (details: `docs/PHASE1.md`)
- [x] T7 minutes core + generator + REST
- [x] T8 minutes review/edit UI
- [x] T9 Word export
- [x] T10 history + search
- [x] T15 topic markers + resume
- [x] T11 login (auth core; UI under C1)
- [x] long transcript (virtualized, paged, search) - done (2026-10-22): `@tanstack/react-virtual`, paged `GET /api/meetings/:id/segments|segments/locate|search`, in-room search (Ctrl/Cmd+F); see `docs/ARCHITECTURE.md` and `docs/UI-AUDIT.md`
- [ ] T12 re-transcription
- [x] T13 usage metering (usage_events: STT seconds, LLM tokens, cost est., per vendor) - T13 done (2026-10-22): migration 004, `repos.usage`, `config/pricing.json`, instrumentation, `/api/usage/*` (see docs/ADMIN.md)
- [ ] T14 admin UI (split A/B/C1/C2 in `docs/ADMIN.md`; v3 Soft style chosen) (login, dashboard, usage, settings) — static HTML preview in `design/admin-preview/` approved by user FIRST, then implement in apps/web with shadcn/ui + shadcn charts re-themed to DESIGN.md; T11 login merged into T14
  - A done (2026-10-22): `packages/admin-ui` (`@recap/admin-ui`) Soft kit: theme, shell, primitives, charts, tests, README, static preview.
  - C1 done (2026-10-22): auth (`@recap/auth`, migration 008, `/login`, proxy, `withAuth`, users API, realtime WS cookie/service token, `npm run create-admin`); see `docs/ARCHITECTURE.md` §8.
  - UI consistency pass done (2026-10-22): kit is the single component source, unified status/dialog/button rules, legacy `components/ui` and `.soft-legacy` removed; see `docs/UI-AUDIT.md` and `docs/DESIGN.md`.
  - C2 done (2026-10-22, visual QA pending): `(app)` shell layout (`AppShell`, nav, user slot from `getCurrentUserForShell`), `/` Tổng quan, `/meetings` (list moved from `/`), `/usage`, `/settings` (providers + `POST /api/settings/test-provider`, pricing, budget, users), `/glossary` stub; room renders bare, minutes/new inside the shell. Not yet screenshotted because auth is enforced (no bypass used); run the screenshot pass with a logged-in session on a scratch demo DB.
- [ ] Minutes generation (OpenAI, JSON schema: topics, key points, status Đã chốt/Chưa chốt/Bác bỏ, decision + timestamp, action items, open issues), uses conclusion marks
- [x] Minutes review/edit screen
- [ ] Word export (VI / EN / bilingual)
- [ ] Meeting history + search, simple login
- [ ] Re-transcribe saved audio after the meeting with a more accurate batch model

## Phase 2 — Usable by other teams
Team glossary UI, templates + custom prompt, teams & sharing, jump-to-audio from decisions, second STT provider.

## Phase 3 — Expansion
Named speaker diarization, action tracking across meetings, Q&A over meeting archive, integrations, desktop app (Mac native-app audio).

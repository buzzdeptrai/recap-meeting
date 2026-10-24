# Admin app (T13 metering · T14 admin-ui + pages + auth)

Read with `docs/PLAN.md`, `docs/DESIGN.md` (section "Admin / app shell"), `docs/PHASE1.md`. Visual reference: `design/admin-preview-v3/`.
Rules as always: files ≤300 lines, functions ≤50, strict TS, vitest, no commit, nothing published, never print keys. Agents use Sonnet.

## Work split
| Id | Scope | Depends |
|---|---|---|
| A  | `packages/admin-ui` (`@recap/admin-ui`): Soft theme tokens, shadcn-style primitives, shell (sidebar/topbar/mobile drawer), StatCard, charts (smooth line+area, stacked bars, navy bar card, sparkline), DataTable, SegmentedControl, ProgressBar, StatusDot, Login form. **No knowledge of meetings/minutes**: nav items, brand, user come in via props/config; data via props. Reusable template for other projects. Includes a preview route or story page. | — |
| B  | T13 usage metering: migration 004 `usage_events`, repo + aggregations, instrumentation of STT/translate/minutes, pricing config, REST `/api/usage/*` | — |
| C1 | Auth: users table (migration 005), scrypt hashes, signed cookie session, Next middleware, `/login`, logout, `npm run create-admin`, realtime WS cookie check | A |
| C2 | Pages in the new shell: `/` Tổng quan, `/usage`, `/settings`; move meeting list to `/meetings`; wrap room/minutes/new in the shell | A, B |

## Route map (target)
`/login` · `/` Tổng quan · `/meetings` list · `/meetings/new` · `/meetings/[id]` room · `/meetings/[id]/minutes` · `/usage` · `/settings` · `/glossary` (stub allowed)

## usage_events (migration 004)
`id, ts, meeting_id NULL, vendor ('deepgram'|'gemini'|'openai'|'assemblyai'), service ('stt_live'|'translate'|'minutes'|'stt_batch'), model, audio_seconds REAL NULL, input_tokens INT NULL, output_tokens INT NULL, requests INT DEFAULT 1, latency_ms INT NULL, status ('ok'|'error'|'fallback'), cost_usd REAL NULL (computed at write time from pricing config, NULL if no price), meta JSON`.
Deepgram live: one row per session close (or per N minutes) with total audio seconds per channel summed ("channel-seconds"). Gemini/OpenAI: token counts from API usage metadata.
Pricing: `config/pricing.json` (vendor/model → per-unit price, `verified: boolean`, `source_url`, `updated_at`). Prices must come from the vendors' official pricing pages (agent may WebSearch/WebFetch); if not verifiable, set `verified:false` and the UI labels them "ví dụ". Never invent silently.
Aggregations: by day/vendor/model/service/meeting; totals; p50/p95 latency; error + fallback rates; month budget (env `USAGE_MONTHLY_BUDGET_USD`).

## Auth
Single-tenant. Roles `admin` | `member`. Passwords scrypt (node:crypto), session cookie HttpOnly+SameSite=Lax, HMAC-signed with `AUTH_SECRET` (env; generate if absent in dev with a warning). Middleware redirects unauthenticated to `/login`; API returns 401. Realtime WS upgrade must verify the same cookie. First admin via `npm run create-admin -- --email --name` (password prompt, never echoed/logged).

## Usage REST (T13, implemented)
All GET, JSON, login required (any role; wrapped in `withAuth`). Query parsing in `apps/web/src/server/usage-range.ts`, logic in `usage-service.ts`.

**Common query**: `from`, `to`, `tz`. `from`/`to` are `YYYY-MM-DD` (local day in `tz`; `to` **inclusive**) or a full ISO instant (`to` exclusive). Defaults: `from` = start of the current local month, `to` = now. `tz` = minutes east of UTC (`420`) or `+07:00`; default `+07:00` (Asia/Ho_Chi_Minh). Max range 366 days. Errors: `400 {error:{code:"VALIDATION",message}}`.
Every response echoes `range: {from, to, tzOffsetMinutes}` (ISO UTC, `to` exclusive).

A **sums object** (`UsageSums`) is `{audioSeconds, inputTokens, outputTokens, requests, costUsd, errors, fallbacks}` (numbers, 0 when empty). `audioSeconds` for Deepgram is channel-seconds (stereo = 2x wall time). `costUsd` sums only priced rows (rows with no price contribute 0). `errors` = failed vendor attempts; `fallbacks` = requests served by a secondary provider after the primary failed.

| Endpoint | Extra params | Response |
|---|---|---|
| `GET /api/usage/summary` | - | `{range, totals: UsageSums, previous: UsageSums (equal-length period right before), deltasPct: {costUsd, audioSeconds, tokens, requests}` (percent, `null` when previous is 0)`, budget: {monthlyUsd, month:"YYYY-MM", spentUsd, projectedUsd, percentUsed, daysElapsed, daysInMonth}` (current local month, independent of range; env `USAGE_MONTHLY_BUDGET_USD`, default 60)`, pricing: {allVerified, unverified:["vendor/model"], updatedAt}}` |
| `GET /api/usage/series` | `metric=cost\|seconds\|tokens\|requests` (cost), `groupBy=vendor\|model\|service` (vendor) | `{range, metric, groupBy, days:["YYYY-MM-DD",...] (zero-filled, local), series:[{key, values:[per day], total}] (sorted by total desc), dayTotals:[per day]}` |
| `GET /api/usage/breakdown` | `groupBy=vendor\|model\|service\|meeting` (vendor) | `{range, groupBy, rows:[{key (null = no meeting), label (meeting title / same as key), costShare (0-1), ...UsageSums}]}` sorted by cost desc |
| `GET /api/usage/reliability` | - | `{range, rows:[{vendor, model, requests, errors, fallbacks, errorRate, fallbackRate (0-1), latency:{count, p50Ms, p95Ms}}]}` (latency of non-error requests, `null` percentiles when none) |
| `GET /api/usage/meetings` | `limit` (10, max 100) | `{range, meetings:[{meetingId, title, ...UsageSums}]}` by cost desc |
| `GET /api/usage/export.csv` | `groupBy=day\|vendor\|model\|service\|meeting` (day) | `text/csv` attachment; columns `key,label,cost_usd,audio_seconds,input_tokens,output_tokens,requests,errors,fallbacks`; formula-looking cells are prefixed with `'` |

UI rule: when `summary.pricing.allVerified` is false, label costs "ví dụ" (example). Event sources: Deepgram live (one row per session end + every 5 min, channel-seconds, per-channel in `meta`, `meta.language`), Gemini/OpenAI translation (one row per provider attempt: `ok`, `error`, or `fallback` when a non-primary provider answered), OpenAI minutes (one row per LLM call, linked to the meeting). Pricing: `config/pricing.json` (`@recap/core` `pricingSchema`, `computeCostUsd`); cost is computed at write time and stored in `cost_usd`.

### Demo data
`npx tsx scripts/seed-usage-demo.mjs [dbPath] [--days 30] [--force]` writes ~30 days of synthetic events and demo meetings into `data/demo.db` (refuses `recap.db`). Preview with `DB_PATH=./data/demo.db npm run dev:web` (do not commit the DB; never use it for real meetings).

## Meetings list REST (migration 009 `list_indexes`)
`GET /api/meetings` (login required). Query: `q`, `status=draft|live|ended`, `minutes=none|vi|en|stale|need` (need = ended and no minutes or stale), `lang=vi|en|multi` (spoken language), `range=today|7d|30d|month|custom` with `from`/`to` (`YYYY-MM-DD`, Vietnam days, inclusive; `from`/`to` alone imply custom), `sort=newest|oldest|duration|name` (default: relevance when `q`, else newest), `limit` (20, max 100), `offset`. Bad values: `400 VALIDATION`.
Response (old fields kept): `{ total, counts:{all,draft,live,ended} (every filter except status), totals:{meetings,durationMs,thisWeek (since Monday, VN),needMinutes} (all filters), meetings:[{...meeting, snippet?, minutesLangs, minutes:{vi?:{source,stale},en?:{...}}, topicCount, conclusionCount, wordCount, firstConclusion?, agendaPreview?}] }`.
Staleness: one rule in `@recap/db` `minutes-staleness.ts` (`isChangedSince` for TS, `minutesStaleSql` for SQL; parity test). `wordCount` counts space-separated tokens; The list carries NO cost/token/usage data (product rule: money lives only on `/usage` and Settings; per-meeting cost is reachable via `GET /api/usage/meetings` / "Cuộc họp tốn nhiều nhất"); `sort=cost` is gone (the page ignores it, REST answers `400 VALIDATION`). Indexes: segments(meeting_id, created_at), meetings(status, created_at). 2,000 meetings x 40 segments: 3.5-15 ms per page (test asserts < 100 ms).

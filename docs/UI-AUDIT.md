# UI consistency audit (2026-10-22)

Scope: every page of `apps/web` against the `@recap/admin-ui` kit and docs/DESIGN.md "Soft style".
Method: read all of `components/ui/*`, `features/**`, `app/**`; headless-Chrome screenshots of every page and every dialog/dropdown state at 1440, 1920 and 500 px (before: `data/screens/ui-audit/`, after: `data/screens/ui-final/`).

## Inventory (before)

| Element | Legacy `components/ui/*` | `@recap/admin-ui` |
|---|---|---|
| Button / link-button | room, minutes, list, 404/error pages (`Button`, `buttonClasses`) | dashboard, usage, settings, login, new-meeting |
| Icon button | minutes rows, room rail (`IconButton`, 28/32 px) | none |
| Dialog | stop-recording, minutes confirms | settings create-user |
| Banner / alert | room banners, minutes banners, list error, new-meeting error | none (settings used hand-made boxes) |
| Pill / status | list, room top bar, minutes top bar | dashboard, usage, settings (`Badge`) |
| Segmented | list filter, room view, minutes lang/topic status | usage range, new-meeting |
| Field / input | list search | new-meeting, create-user |
| Tooltip, EmptyState, Kbd, LevelMeter | all legacy | EmptyState/Tooltip only |
| Toast | none exist | none |
| Skeleton | hand-built `animate-pulse` spans | `Skeleton` |

After: everything above is imported from `@recap/admin-ui` (apart from `StatusBadge`, a 25-line wrapper that maps `lib/status.ts` onto the kit `Badge`). `apps/web/src/components/ui/` (12 files) and `.soft-legacy` are deleted.

## Findings

Status: fixed / deferred. IDs are referenced from the report.

| # | Surface | Issue | Fix | Status |
|---|---|---|---|---|
| 1 | whole app | two component systems (legacy graphite vs Soft kit) | migrated all 20 import sites to the kit, deleted legacy | fixed |
| 2 | globals.css | `.soft-legacy` stopgap scope re-coloured legacy classes | app tokens (`--fg`, `--surface`, ...) are now aliases of `--soft-*`; scope removed; room now shares the shell palette | fixed |
| 3 | dashboard vs list | finished meeting labelled "Hoàn tất" in one place, "Đã kết thúc" in the others | single `MEETING_STATUS` map | fixed |
| 4 | dashboard | "Chưa có biên bản" shown in amber (amber is reserved for conclusions) and replaced the meeting status | status badge is always the meeting status; missing minutes is muted text | fixed |
| 5 | usage vs settings | unverified prices: purple "ví dụ" pill vs amber "Ví dụ" badge | one `PRICING_STATUS.example` (purple, "Ví dụ") | fixed |
| 6 | list vs dashboard | same EN/VI chips meant "minutes exist" in the list but "source/target language" in the dashboard, different look | both show minutes languages with the kit chip badge | fixed |
| 7 | all copy | mixed spelling: Huỷ/xoá/khoá/hoá/tuỳ vs Hủy/xóa | normalised to Hủy, xóa, khóa, hóa, tùy (22 places, 9 files) | fixed |
| 8 | dialogs | 3 anatomies (legacy top-1/3 bordered, kit centred, create-user with its own button row); stop dialog cancel was a bordered button | one `Dialog` (title, description, body, error slot, footer) + `ConfirmDialog`; cancel = ghost on the left, confirm on the right, danger for destructive; busy blocks Escape/scrim/close; "Hủy" default | fixed |
| 9 | settings users | lock/unlock and reset password fired instantly | `ConfirmDialog` per action (lock is danger) | fixed |
| 10 | settings users | create-user error was a loose paragraph, form buttons outside the footer | `Dialog.error` + shared footer, form linked by `form=` id | fixed |
| 11 | 404 | off-brand (graphite bar, blue button) and said "Không tìm thấy cuộc họp này" for any URL | `StandalonePage` in Soft style, generic copy; `(app)/not-found.tsx` keeps the shell for unknown meeting ids | fixed |
| 12 | root error page | off-brand | same `StandalonePage` | fixed |
| 13 | error pages | used legacy `AppHeader`/`Wordmark` (double chrome inside the shell) | deleted both; shell error pages use Card + EmptyState | fixed |
| 14 | minutes load error | bare "Tải lại" button, no message | EmptyState with message | fixed |
| 15 | room / providers / minutes | disabled controls without a reason (Chủ đề mới, Đánh dấu kết luận, Kiểm tra kết nối, Lưu) | visible hint under the mark buttons; hint + title on provider test; title on Lưu | fixed |
| 16 | primary buttons, active pills, help card | white text on `#ff0080` is 3.8:1 | gradient end `#e0006f` (4.7:1); danger gradient `#c60404 -> #dc1f3a` (4.9:1, was 2.9:1 on the light end) | fixed |
| 17 | dashboard navy chart | axis labels repeated (0,2 / 0,2 / 0,1 / 0,1) because ticks were rounded to 1 decimal | decimals derived from the tick step (`stepDecimals`, tested) | fixed |
| 18 | usage / pricing | ISO dates ("2026-10-22") in an otherwise dd/mm/yyyy UI | `formatIsoDate` (tested) | fixed |
| 19 | settings providers | status shown twice (dot + badge); test result as coloured text | single `StatusBadge`; result is a success/error `Banner` | fixed |
| 20 | room, minutes | uppercase labels in mono (room) vs bold sans (shell) | bold sans everywhere, mono only for numbers/timestamps | fixed |
| 21 | forms | hand-rolled textarea + legacy TextInput/TextArea/Field render-prop | kit `Field` (+`optional`), `Input`, new `Textarea` | fixed |
| 22 | segmented controls | three looks (bordered radiogroup, pill, tabs) | kit `SegmentedControl` with `size` + `fill`; topic status labels from `TOPIC_STATUS` | fixed |
| 23 | banners | legacy bordered bars; settings/users used ad-hoc coloured boxes | kit `Banner` (info/success/warn/error, `card`/`bar` layout, correct `role`) | fixed |
| 24 | icon buttons | legacy 28/32 px, back arrows hand-styled twice | kit `IconButton` 32/40 + `iconButtonVariants` for links | fixed |
| 25 | radii | 6/8 px (legacy) vs 12/16 (Soft), patched by CSS scope | `rounded-control` 10, `rounded-panel` 16 = `rounded-soft` | fixed |
| 26 | focus | 2 px blue ring (legacy) vs 3 px purple (kit) | global `:focus-visible` uses the kit ring | fixed |
| 27 | tooltips | two implementations with different delays/colours | kit only | fixed |
| 28 | empty states | left-aligned document style vs centred kit | kit `EmptyState` in a `Card`, with icon | fixed |
| 29 | room level meters | legacy component, uncovered | kit `LevelMeter` (pure props) + tests | fixed |
| 30 | service health | labels duplicated in `serviceHealth` and views | `SERVICE_HEALTH` map | fixed |
| 31 | dark theme | OS dark preference darkened only legacy parts (room/list) while the shell stayed light | removed OS-dark block; dark is `data-theme="dark"` only (kit stub) | fixed |
| 32 | list loading | hand-built pulse spans | kit `Skeleton` | fixed |
| 33 | minutes | stale/failure banners and Tạo lại/Lưu used legacy secondary buttons | kit `Banner` + `Button variant="outline"` | fixed |
| 34 | dark theme | still an untuned stub (neutral greys, amber tokens swapped) | not built, as instructed | deferred |
| 35 | room (live) | REC pill, level meters, reconnect/mic banners, Stop dialog could not be driven without a real microphone/tab-audio session | restyled with the same kit parts as the verified states (ended/draft rooms, minutes confirms); not seen live | deferred (unverified) |
| 36 | minutes | generating spinner, stale banner and failure banner states need backend conditions (a paid LLM call, stale data) | restyled, markup covered by the shared Banner tests; not screenshotted | deferred (unverified) |
| 37 | feedback | no toast component; success feedback is inline ("Đã lưu hh:mm") | none needed today; add a kit Toast when a flow needs it | deferred |
| 38 | /glossary | feature stub ("Sắp có") reachable from the nav | kept on purpose: it says honestly that it is not enabled | deferred |
| 39 | room inline title, topic-name input | quiet inline editors keep their own small input styling | intentional (edit-in-place); they use the shared tokens and focus ring | deferred |
| 40 | tab order | checked on the room page and dialogs only (focus lands on Hủy in confirms) | full keyboard pass not done page by page | deferred |

Totals: 40 findings, 33 fixed, 7 deferred (3 of them verification gaps).

## Meetings list redesign (2026-10-22)

`/meetings` rebuilt with kit components only; screenshots in `data/screens/meetings-list/` (1440, 1920, 500; default, filters, search, empty, loading, error, dialogs, menus). Seed: `scripts/seed-meetings-demo.mjs` (scratch DB `data/demo-list.db`), driver: `scripts/qa-cdp.mjs` + `scripts/qa-meetings-list.scenarios.mjs`.

- Summary strip (4 clickable `StatCard` tiles: total, total duration, this week, minutes waiting) that apply the matching filter.
- One filter card: search (`/`, debounce, snippet highlight), status chips with live counts, selects for Biên bản / Ngôn ngữ / Thời gian (+ custom dates) / Sắp xếp, removable chips, "Xóa bộ lọc", result count. All state is URL-driven (`?q&status&minutes&lang&range&from&to&sort`, `lib/list-query.ts`).
- Rows grouped by Vietnam calendar day with sticky headings; table from 1280 px, stacked cards below, optional Bảng/Thẻ toggle (localStorage, try/catch). Counters (chủ đề, kết luận, từ), language pair badge, minutes badges per language (stale uses the `warn` tone from `status.ts`, amber stays for conclusions), `StatusBadge` (live dot pulses).
- Row actions on hover/focus: Mở phòng, Biên bản/Tạo biên bản, Xuất Word (VI/EN/Song ngữ, disabled with a reason), "⋯" with Sao chép liên kết. Whole row is a stretched link with a focus ring. No delete.
- "Hiển thị 20 / 53" + Tải thêm, skeleton rows (only when a request takes > 150 ms), empty database (CTA + how it works), no results, error banner with retry. Phones: filters in a kit `Dialog`.
- Deferred / not verified: dark theme; real touch device; Word export download was not clicked (links only checked); error state keeps the previous rows under the banner.

## Button layout pass (2026-10-22)

Rules: docs/DESIGN.md "Button placement". Screens: `data/screens/buttons/` (1440 and 500).

| Surface | Current | Fix | Status |
|---|---|---|---|
| Dashboard | page header had only a text link | gradient "Cuộc họp mới" at the title row; empty-state action is outline | fixed |
| New meeting | form footer ad-hoc flex | `ActionGroup start` (primary then ghost Hủy; stacked on phones) | fixed |
| Minutes top bar | Tạo lại + Lưu; no Word export in the UI | `[Tạo lại][Xuất Word ▾][Lưu]`, options by available languages (`export-options.ts`, tested); Lưu tooltip when clean | fixed |
| Room (ended) | primary "Ghi tiếp" left of outline "Biên bản" | outline first, primary at the right end | fixed |
| Room (draft) | second gradient "Bắt đầu ghi" inside the checklist | removed; checklist points at the top bar | fixed |
| Room mark buttons | generic disabled text | clear reason + `aria-describedby` | fixed |
| Room banners | "Đóng" was ghost, others outline | all outline | fixed |
| Settings users | outline "Khóa" + ghost text "Đặt lại mật khẩu" | `IconButton` group (lock/key) with names | fixed |
| Settings providers | test button under the card, left | hint left, outline button right, result below | fixed |
| Settings budget | text link at the bottom | `CardLink` top right | fixed |
| Usage | Xuất CSV in the table CardHeader, 12px gaps | kept there (rule 2), gaps 8px via `ActionGroup` | fixed |
| Glossary | text link as action | outline link button | fixed |
| 404 / error pages | primary to the meeting list, ghost to list | primary "Về trang chủ" / "Thử lại" + ghost | fixed |
| Dialog footers (all) | right-aligned, but side by side on phones | `ActionGroup end`: stacked full width, primary last | fixed |
| Meetings list `/meetings` | owned by the list agent | not touched; needs `PageHeader` primary "Cuộc họp mới" and `ActionGroup` for its toolbar | pending (list agent) |
| Login | single full-width primary | already compliant | ok |

## Money only on Usage (2026-10-22)
Product rule: cost, tokens, seconds and budget appear ONLY on `/usage` and Settings (Ngân sách, Bảng giá). Removed everywhere else:
- `/meetings`: Chi phí column/field (table + cards), cost tooltip, "Chi phí" sort (`?sort=cost` now falls back to the default), `costUsd` in `GET /api/meetings`, the usage_events join in the list SQL. Table columns re-balanced (`minmax(0,1fr) 112 168 176 124`).
- `/` Tổng quan: Giờ chép lời, Token LLM, Chi phí + budget bar, navy hours card with vendor mini stats, cost line, pricing banner, "Xem mức sử dụng" link. Now meeting-only: stat cards Cuộc họp / Giờ họp / Biên bản chờ tạo-duyệt (link to `/meetings?minutes=need`) / Kết luận đã đánh dấu; chart "Cuộc họp theo ngày" (+ Giờ họp); Cuộc họp gần đây; Cần xử lý (no minutes, stale minutes, drafts > 7 days, empty meetings, one outline action each); Tình trạng dịch vụ (error rate + p95 only).
- Other surfaces audited (shell, top bars, room rail, minutes, export menus, empty states, README): no further leaks.
Screens: `data/screens/no-cost/`.

## Long transcript: virtualized, paged, searchable (2026-10-22)
Room (`/meetings/[id]`) now scales to 2-6 h meetings (~8,000 segments). Visual design unchanged; additions: a search icon in the top bar (Ctrl/Cmd+F while focus is in the room or on the page body; Esc closes) opening a search bar above the list ("n kết quả", Enter / Shift+Enter or ↑/↓, hits list with timestamps, matches marked inside rows); the pill reads "Về cuối" for ended meetings and "Về dòng mới nhất" while live. Ended meetings open at the START of the transcript (before: at the bottom). Edge loaders "Đang tải đoạn trước/tiếp…" (with "Thử lại") sit at loaded edges. The list is `role="log"` (focusable, `aria-label` with the segment count, `aria-busy` while paging) with `listitem` rows; Home/End jump to the start/end of the whole meeting, ↑/↓ on a focused row move between rows; `prefers-reduced-motion` disables smooth jumps.
Measured on synthetic meetings (headless Chrome, 1440x900, scratch DB; `scripts/qa-long-measure.mjs`):
| | 2 h (2,400 seg) before -> after | 6 h (7,488 seg) before -> after |
|---|---|---|
| HTML+RSC bytes | 3,210,658 -> 185,244 | 9,803,951 -> 192,577 |
| DOM nodes after load | 19,791 -> 444 | 60,678 -> 485 |
| `load` event | 559 ms -> 189 ms | 1,279 ms -> 267 ms |
| JS heap after load / after scroll to end | 25 / 28 MB -> 13 / 15 MB | 51 / 60 MB -> 13 / 15 MB |
| `?t=` deep link until row visible | 2,715 ms -> 352 ms | 1,493 ms -> 433 ms |
| 3 s programmatic scroll | 16.7 ms frames, 0 over 50 ms (both) | 1 frame 83 ms -> 0 over 50 ms, 0 long tasks |
| search API (warm) | n/a -> ~20 ms | n/a -> ~15 ms |
Behaviour checks: `scripts/qa-long-behaviour.mjs` (prepend keeps the viewport still, Home/End, deep link centring, Ctrl+F, hit navigation, topic jump), `scripts/qa-long-live.mjs` (fake capture + fake WebSocket: follow, append, scroll-up stops following, pill). Screens: `data/screens/long-transcript/`.

## admin-ui v2 (2026-10-24)
Kit 0.2.0 adds the room-preview components and tokens (FloatCard, PillTabs, Chip, IconBadge, Bubble, FloatingActionBar, StatTile; olive `Banner warn`); room itself not migrated yet. See DESIGN.md "admin-ui v2" and the kit CHANGELOG.

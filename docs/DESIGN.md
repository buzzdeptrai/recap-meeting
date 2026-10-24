# Design Direction — "Biên bản" (the record)

Goal: looks like a serious professional tool a company pays for. Calm, precise, document-like.
It must **not** look AI-generated.

## Concept
A meeting is a *record*. The transcript is the hero and reads like a well-set document;
controls stay quiet around it. Think: a court stenographer's record crossed with a modern
desktop tool (Linear / Things level of restraint). Information density over decoration.

## Do NOT use (generic-AI tells)
- Purple/blue gradients, glassmorphism, glow, blurred blobs, neon accents on near-black
- Cream background + serif display + terracotta accent
- Inter / Space Grotesk as the face; emoji as icons or section markers
- Everything centered; big hero sections; `rounded-2xl` + shadow on every block
- shadcn default look (zinc + rounded-lg cards everywhere); generic "sparkles ✨" AI icons
- Numbered 01/02/03 decoration unless it is a real sequence

## Typography
- UI + transcript: **Be Vietnam Pro** (designed for Vietnamese diacritics) 400/500/600 via `next/font/google`
- Numbers/timestamps/meta: **JetBrains Mono** 500 (tabular)
- Scale (px): 12 meta · 13 small UI · 14 base UI · 16 transcript body (line-height 1.65) · 20 page title · 28 rare display
- Uppercase labels: 11px, letter-spacing .08em, mono
- Transcript max line length ~72ch

## Color tokens (CSS variables, light first; dark redefines all)
Neutrals have a slight cool-blue bias (graphite), never pure grey.
| token | light | dark | use |
|---|---|---|---|
| `--bg` | #F6F7F9 | #0F1216 | app background |
| `--surface` | #FFFFFF | #161A20 | panels |
| `--surface-2` | #EEF0F3 | #1D222A | hover, inset |
| `--line` | #DCE0E6 | #2A303A | 1px hairlines |
| `--fg` | #12161C | #E6E9EE | primary text |
| `--fg-muted` | #5A6472 | #98A2B0 | secondary text, translations |
| `--accent` | #1F4FD1 | #6E93FF | primary actions, "Tôi" channel, focus ring |
| `--others` | #0F766E | #3CC0B1 | "Người khác" channel |
| `--decision` | #B45309 | #F2A34A | conclusion marks — the only warm color |
| `--decision-bg` | #FDF1E3 | #33240F | |
| `--rec` | #D92D20 | #FF6B5E | recording dot/state |
| `--ok` / `--warn` / `--err` | #1E7B4A / #B45309 / #C2332A | #4CC38A / #F2A34A / #FF7A6E | status |

## Shape, depth, motion
- Radius: 6px controls, 8px panels. (Superseded by Soft: see the admin section and "admin-ui v2" below; floating cards go up to 24px.)
- Depth by hairlines + background steps (Soft/v2 pages use card shadows instead, see below).
- Motion 120–160ms ease-out; new transcript segment fades in 8px; respect `prefers-reduced-motion`.
- Focus ring: 2px `--accent` offset 2px, always visible on keyboard focus.

## Layout
### Meeting list `/`
Top bar: product mark (wordmark "Biên bản" set in Be Vietnam Pro 600, small square monogram), "Cuộc họp mới" primary button.
Table-like list (not cards): Tiêu đề · Ngày · Thời lượng (mono) · Ngôn ngữ (e.g. `VI → EN`) · Trạng thái pill.
Empty state: one sentence + primary button + 3-line how-it-works.

### New meeting `/meetings/new`
Narrow form (max 560px): Tiêu đề, Ngôn ngữ nói (Tự động / Tiếng Việt / English / Lẫn Anh–Việt), Dịch sang (Tiếng Việt / English), Agenda (optional textarea). Primary: "Tạo và vào phòng họp".

### Meeting room `/meetings/[id]` (the core screen)
```
┌ top bar ─ ← Title (editable) ·· ● REC 00:12:47 (mono) ·· [Song song|Gốc|Bản dịch] ·· [Dừng] ┐
├ source strip: [Âm thanh cuộc họp ▮▮▮▯ ok] [Micro của bạn ▮▮▯▯ ok]   status: STT open · Gemini ┤
│ transcript (scroll, auto-follow; "Về dòng mới nhất" pill when user scrolls up) │ right rail 320px │
│ 00:03:12  NGƯỜI KHÁC                                                          │ [Đánh dấu kết luận K]│
│   We can hold the price at 345 if they sign this quarter.                    │ Kết luận đã đánh dấu │
│   Chúng ta có thể giữ giá 345 nếu họ ký trong quý này.   (muted, lang tag)   │  00:03:15 ·····      │
│ 00:03:20  TÔI                                                                 │ Phiên                │
│   ...interim text in lighter italic...                                        │  độ trễ dịch 0.9 s   │
└───────────────────────────────────────────────────────────────────────────────┴──────────────────────┘
```
- Segment row: timestamp (mono, muted) | channel label (11px mono uppercase, colored `--accent` / `--others`) | original (fg) with translation directly below (fg-muted, slightly smaller), small `EN`/`VI` tag.
- A segment within ±10 s of a conclusion mark gets a thin `--decision` left rule + tiny "Kết luận" tag.
- Before start: the transcript area shows a real setup checklist (genuine sequence → numbered):
  1. Mở Zoom/Teams bằng trình duyệt Chrome/Edge 2. Bấm Bắt đầu, chọn đúng tab cuộc họp 3. Tích "Chia sẻ âm thanh tab" 4. Đeo tai nghe để tránh lặp tiếng.
- Missing tab audio → `--warn` banner under top bar: "Chưa nhận được âm thanh cuộc họp. Hãy chia sẻ lại và tích 'Chia sẻ âm thanh tab'." with "Chia sẻ lại" button.
- Server down → `--err` banner "Không kết nối được máy chủ ghi âm" + retry.
- Responsive: < 1024px the right rail collapses below; < 640px source strip stacks.

## Components
Single source: `@recap/admin-ui` (see `packages/admin-ui/README.md`). There is no app-level primitive layer any more; `apps/web/src/components/status-badge.tsx` only maps statuses onto the kit `Badge`.
Icons: `@phosphor-icons/react`, weight "regular", 16/18px. Never emoji.

## Copy (Vietnamese, plain)
Buttons say exactly what happens: "Bắt đầu ghi", "Dừng ghi", "Đánh dấu kết luận", "Chia sẻ lại".
Errors say what went wrong and how to fix it. No exclamation marks, no "AI magic" language.

---

## Admin / app shell — "Soft" style (decided 2026-10-22, supersedes the graphite look for the shell and admin pages)
Owner chose preview v3 (`design/admin-preview-v3/`, pages `dashboard.html`, `usage.html`; v1/v2 are rejected references).
The transcript room keeps the calm "Biên bản" reading layout but sits inside the same shell, same tokens for radius/shadow.
- Page bg light cool grey `#F8F9FA`; text navy-slate `#344767`; muted `#67748E`. Dark mode: neutral dark greys (stub; v2 adds dark values for its tokens).
- Floating white sidebar (rounded, soft shadow, margin around it); nav rows with a small rounded icon tile; ACTIVE tile = purple→pink gradient, white icon.
- Cards: white, radius 16px (v2 floating cards: 24px, see below), soft shadow `0 20px 27px rgba(0,0,0,.05)`, no borders, 20–24px padding.
- Signature gradient `linear-gradient(310deg,#7928CA,#FF0080)` for primary buttons, active tiles, gradient progress bars, headline accents.
  Dark navy gradient `linear-gradient(310deg,#141727,#3A416F)` for one hero chart card. Secondary tile gradients (blue, orange, green, red) used sparingly.
- Charts: smooth line + soft area fill, rounded white bars on navy card, dashed light gridlines. Numbers in mono where tabular.
- Amber stays reserved for conclusions in minutes. Font stays Be Vietnam Pro (+ JetBrains Mono). No emoji.
- Do not copy Creative Tim code/assets/wording (paid product); this is our own implementation of the look.

## Component and status rules (final, UI consistency pass 2026-10-22)
Details of every change: `docs/UI-AUDIT.md`.

**Tokens.** The app token names (`bg-surface`, `text-fg-muted`, `text-accent`, ...) are aliases of the kit's `--soft-*` tokens in `globals.css`; there is no second palette and no scoped override. Radii: controls 10px, inputs/buttons 12px, cards/dialogs 16px, v2 floating cards 24px / inner blocks 18px / pills fully round. Focus ring: 3px `--soft-focus` on every interactive element. Shadows only on cards, popovers, dialogs.

**Buttons** (kit `Button`, `buttonVariants` for links): `primary` (gradient, one per view), `outline`, `ghost`, `danger`; sizes `sm` 32 / `md` 40 / `lg` 48; `icon` prop for a leading 16px icon; `loading` shows a spinner and disables. Icon-only: `IconButton` (needs `label`, tooltip included; `iconButtonVariants` for `<Link>`). White text only on gradients whose darkest-to-lightest contrast is >= 4.5:1.

**Dialogs.** Always `Dialog` (custom body) or `ConfirmDialog` (yes/no). Anatomy: title, optional description, body, error slot, footer. Footer order: cancel (ghost, "Hủy") left of the primary; destructive or hard-to-undo confirm uses `danger`. Use a contextual cancel label only when "Hủy" is ambiguous ("Tiếp tục ghi" on stop). While the action runs the dialog is `busy` (Escape/scrim/close disabled, button spinner); a failed action keeps the dialog open and shows the message in the error slot. Focus is trapped, Escape closes, focus returns to the trigger; initial focus lands on the cancel button of confirms.

### Money lives only on Usage (2026-10-22)
Cost, token, seconds-billed and budget figures (and pricing notices) may appear only on `/usage` and in Settings (Ngân sách, Bảng giá). Meetings list, dashboard, room, minutes, exports and the shell show none. Per-meeting spend is reachable only through the Usage page ("Cuộc họp tốn nhiều nhất" links to the meeting).

### Button placement (2026-10-22)
Primitive: kit `ActionGroup` (`placement`: `toolbar` | `end` | `start` | `center`; 8px gap, equal heights, mobile behaviour built in). `PageHeader` actions, `CardHeader` action and `Dialog` footers already use it; do not hand-roll flex rows for buttons.
1. **Page primary**: ONE gradient button at the right end of the title row (`PageHeader actions`, e.g. "Cuộc họp mới"). Never two gradient buttons side by side or two primaries on one screen (empty states use outline).
2. **Card/table secondary**: right end of `CardHeader`, outline, same size as neighbours, after any primary ("Xuất CSV"). Multi-option exports are ONE outline button with a `DropdownMenu` ("Xuất Word ▾"); unavailable options stay in the menu, disabled, with the reason as sub-text; a fully disabled trigger gets a tooltip.
3. **Dialog footers**: right-aligned, ghost "Hủy" immediately left of the confirm; destructive confirm = `danger`; busy disables both.
4. **Minutes top bar**: `[VI|EN] ... [Tạo lại] [Xuất Word ▾] [Lưu]`; "Lưu" is the only gradient, enabled only when dirty (badge "Chưa lưu", tooltip when off). Word export is the saved version (menu says so when dirty).
5. **Room**: exactly one primary by state (Bắt đầu ghi / Dừng ghi `danger` / Ghi tiếp); "Biên bản" is outline and sits left of it; mark buttons are outline with `Kbd` hints and an `aria-describedby` reason when not recording.
6. **Groups**: gap 8px, icon left of the label, icon-only = `IconButton` (aria-label + tooltip). Card forms: primary first, ghost "Hủy" after (`start`); dialogs: `end`. Below 640px both stack full width with the primary at the bottom. Sticky bars only for long editors (minutes).
7. **Links vs buttons**: link-looking buttons use `buttonVariants`, real buttons `Button`. Text-only actions are limited to tertiary `CardLink` ("Xem tất cả ›"); row actions are `IconButton` groups.
8. **404 / error pages**: primary "Về trang chủ" / "Thử lại" plus ghost secondary, centred.

**Banners.** Kit `Banner`: tones info / success / warn (olive-yellow since v2) / error; optional `onDismiss`; `layout="card"` in content, `"bar"` full width under a top bar; action = `Button size="sm" variant="outline"`. Errors/warnings are `role="alert"`.

**Status system** (`apps/web/src/lib/status.ts`, rendered by `StatusBadge`; colour is never the only cue: label + dot).
| Domain | Status -> label (tone) |
|---|---|
| Meeting | draft "Nháp" (grey) · live "Đang họp" (magenta) · ended "Đã kết thúc" (green) |
| Topic | decided "Đã chốt" (**amber**) · open "Chưa chốt" (grey) · rejected "Bác bỏ" (red) |
| Recording | idle "Chưa bắt đầu" (grey) · recording "REC" (magenta) · reconnecting "Mất kết nối" (red) |
| Service health | ok "Hoạt động" (green) · warn "Có lỗi" (yellow) · bad "Lỗi nhiều" (red) · idle "Chưa có dữ liệu" (grey) |
| Provider | configured "Đã cấu hình" (green) · missing "Thiếu khóa" (red) · unused "Chưa dùng" (grey) |
| User | active "Hoạt động" (green) · disabled "Đã khóa" (grey) |
| Pricing | verified "Đã xác minh" (green) · example "Ví dụ" (purple) |
| Minutes source | ai "AI tạo" (purple) · edited "Đã chỉnh sửa" (grey) · unsaved "Chưa lưu" (yellow) |
Amber (`conclusion` tone, `--decision*`) belongs to conclusions and decisions only: the "Đã chốt" topic status, the conclusion box in minutes, the "Kết luận" tags and rail in the room. Warnings that are not decisions are yellow `warn`. A test (`lib/status.test.ts`) fails if another domain uses the amber tone.

**Copy.** Vietnamese, new-style tone marks: Hủy, xóa, khóa, hóa, tùy. Cancel is "Hủy", never "Huỷ". Numbers vi-VN (`1.234,5`), dates `dd/mm/yyyy` (ISO strings go through `formatIsoDate`), timestamps `hh:mm:ss` in mono. No exclamation marks.

**States.** Every list/page has loading (kit `Skeleton`), empty (kit `EmptyState` + action) and error (Banner with retry, or shell error page) states. A disabled control must say why (hint text or `title`).

**Dark theme.** Still a stub (`data-theme="dark"`, neutral greys; v2 tokens have dark values); the kit never follows the OS preference by itself.

## admin-ui v2 (2026-10-24)
Kit 0.2.0 (`packages/admin-ui/CHANGELOG.md`) holds everything the approved room preview (`design/room-preview-v1/`, derived from `admin-preview-v6`) needs. The room is redesigned with it in a separate step; until then the old room code keeps working.

**Contradictions resolved.** "No radius > 10px" (graphite era) and "cards 16px only" no longer hold: floating cards are **24px** (`rounded-soft-card`), inner blocks 18px, pills/segments fully round; 16px `Card` stays for admin pages. Accents are **blue** (`soft-accent`, tone-a) and **teal** (tone-b) in the room; the gradient purple primary and purple focus ring remain app-wide until the owner decides on a full palette switch (open item). Warnings are olive-yellow (`warn`), never amber.

**New tokens** (`--soft-*`, dark values included): `page` (pale tinted page bg, opt-in `bg-soft-page`; `--soft-bg` unchanged), `inset`, `inset-2`, `line-strong`, `faint`, `accent(-soft|-ink)`, `tone-a-*` / `tone-b-*` (`bg|ink|chip|bar`), `info-*`, `ok-bg|ink`, `danger-bg|ink`, `olive-*`, `conclusion-line`, radii `card|inner|pill`, shadows `card` (soft), `float` (bars), `seg` (active tab).

**New components:** `FloatCard`, `PillTabs`, `Chip`, `IconBadge`, `Bubble`, `FloatingActionBar`, `StatTile`; extended `Banner` (olive warn, `onDismiss`, `radius`), `SegmentedControl variant="soft"`, `LevelMeter variant="compact"`, `Button shape="pill"`.

**Room rules.**
- Layout: tinted page, floating cards (top bar + source strip, transcript, side panel) with 16px gaps; no hairline-separated panels.
- Channels: lowercase labels ("Tôi", "Người khác") with a round icon (`IconBadge` tone-a = mic/self, tone-b = tab/other); utterances in `Bubble` tone-a / tone-b; interim text is a `dashed` bubble.
- Side panel: `PillTabs` with count badges; unavailable tabs are disabled with a reason.
- Marking: one `FloatingActionBar` at the bottom centre of the transcript card, outline pill buttons with `Kbd` hints (hints hidden below 640px); disabled buttons say why.
- Amber (`decision` chip, `emphasis="decision"` ring, `countTone="decision"`) only for conclusions; all other warnings use olive `warn`.
- Still no money/token numbers in the room, no emoji, no gradients except the Soft signature ones.

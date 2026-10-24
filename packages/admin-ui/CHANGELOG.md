# Changelog — @recap/admin-ui

## 0.2.2 — contrast and selected states (2026-10-24)

Owner feedback: buttons, tabs and the active menu item were all white on grey, so selected vs unselected was hard to see and the UI felt washed out.

### Changed

- `Button variant="outline"` (and new alias `tonal`) is now a blue tint: `bg-soft-tonal-bg` + `text-soft-tonal-ink`, hover `bg-soft-tonal-hover`. The old white/shadow look lives on as `variant="plain"` (hairline ring). `ghost`: ink text, tonal tint on hover (was muted text, grey hover). Disabled opacity 50 -> 60 (kept readable). `IconButton` default hover, `Select` trigger, `DropdownMenu`/`Select` highlighted items and sidebar/dialog icon buttons use the same tint.
- `PillTabs`, `SegmentedControl` (`soft`, `tabs`) and `Tabs`: active = solid brand (`bg-soft-solid`, white bold text); inactive = transparent with `soft-muted` text on a `soft-inset` track with a `line-strong` inset hairline; inactive hover = `soft-inset-2`. Inactive count badges are white chips, active count is white-on-blue.
- Sidebar `NavItem` active: tonal background, bold `soft-tonal-ink`, 3px rounded left accent bar (was white card + shadow); inactive hover = tonal tint. The icon tile gets a hairline ring.
- `Card`, `FloatCard`, `Sidebar` get `border border-soft-line-strong`. `Input`/`Textarea` use `soft-inset` + `line-strong` border (white on focus). Neutral `Chip` uses inset + hairline.
- Tokens: `--soft-bg` `#f8f9fa -> #eef2f9`, `--soft-page` `#eef2f9 -> #e5ebf6`, `--soft-muted` `#67748e -> #54617c` (dark `#9aa2b1 -> #a9b1bf`), `--soft-line` `#e9ecef -> #dfe5f0`, `--soft-fill` `#f0f2f5 -> #e6ebf5`, `--soft-inset` `#f3f6fc -> #e9eefa`, `--soft-inset-2` `#e8edf7 -> #dbe4f4`, `--soft-line-strong` `#d3dcee -> #cbd6ea`, dark `--soft-accent-ink` `#93b8ff -> #a9c8ff`.

### Added

- Tokens (light + dark) and utilities: `--soft-solid` (`#1d4ed8`; dark `#2563eb`, white 5.2:1), `--soft-tonal-bg` (`#e1e9ff`; dark brand 20%), `--soft-tonal-hover` (`#d0defd`; dark 32%), `--soft-tonal-ink` (`#1e40af`; dark `#a9c8ff`).
- `buttonVariants` variants `tonal`, `plain`.

### Contrast (WCAG)

muted on white 6.2:1, on page 5.2:1, on inset 5.4:1; tonal ink on tint 7.2:1 (hover 6.5:1); white on solid 6.7:1 (dark 5.2:1); dark muted on surface 8.0:1, tonal ink on tint 7.8:1.

## 0.2.1 — blue brand (2026-10-24)

The whole kit moves from purple to blue (owner decision, matches `design/room-preview-v1`).

### Changed

- `--soft-purple` renamed `--soft-brand` (`#7928ca` -> `#1d4ed8`; dark `#3b82f6`). Utilities `text|bg|border|ring|accent-soft-brand` replace `*-soft-purple`. `--soft-purple` / `text-soft-purple` stay as deprecated aliases of the brand token.
- `--soft-g-main` (primary button, active nav tile, pill segments, help card): `#7928ca -> #e0006f` becomes `#1d4ed8 -> #2f6bf0`. White text: 6.7:1 and 4.7:1. Glow/shadow rgba follows (`29,78,216`).
- `--soft-focus`: `rgba(121,40,202,.45)` -> `rgba(29,78,216,.7)` (about 3.0:1 on white); dark `rgba(96,165,250,.7)` (about 4.0:1 on `#191b20`).
- `--soft-chart-1` -> `#1d4ed8`; charts/sparkline strokes follow `--soft-brand`. `--soft-pink` is unchanged (recording dot, chart-2).
- `Badge variant="accent"` added (blue); `variant="purple"` is now an alias of it; `Pill` uses `accent`.
- `--soft-tone-a-*` moved from the accent blue to sky blue (`#0369a1` ink / `#0284c7` bar; dark `#7dd3fc` / `#0ea5e9`) so row tone-a no longer collides with `--soft-accent`. Tone-b teal, amber, olive, danger and ok are unchanged.

## 0.2.0 — "admin-ui v2" (2026-10-24)

Adds everything the approved room preview (`design/room-preview-v1`) needs. Mostly additive; light theme of existing pages is unchanged except the two items under "Changed".

### Added

- Tokens (`theme.css`, all with dark values): `--soft-page` (pale tinted page bg, opt-in `bg-soft-page`), `--soft-inset(-2)`, `--soft-line-strong`, `--soft-faint`, `--soft-accent(-soft|-ink)` (blue), tone pair `--soft-tone-a-*` (blue) / `--soft-tone-b-*` (teal) with `bg|ink|chip|bar`, `--soft-info-*`, `--soft-ok-bg|ink`, `--soft-danger-bg|ink`, olive warning `--soft-olive-*`, `--soft-conclusion-line`, radii `--soft-radius-card` (24px) / `-inner` (18px) / `-pill`, shadows `--soft-shadow-card|float|seg`. Utilities: `bg-soft-*`, `text-soft-*`, `rounded-soft-card|inner|pill`, `shadow-soft-card|float|seg`.
- Components: `FloatCard`, `PillTabs` (+ `pillTabId`, `pillTabPanelId`), `Chip`, `IconBadge`, `Bubble`, `FloatingActionBar`, `StatTile`; helpers `nextTabIndex`, `resolveSelectedTab`, `bubbleClasses`, `chipVariants`, `ROW_TONE_*`.
- `Button`/`buttonVariants`: `shape="pill"`.
- `Banner`: `onDismiss` + `dismissLabel`, `radius="lg"` (18px card).
- `SegmentedControl`: `variant="soft"` (inset pill track, white active chip).
- `LevelMeter`: `variant="compact"` (+ `statusText`, `statusTone`, `icon`, `tone`).

### Changed (visible on existing pages)

- `Banner tone="warn"` is now olive-yellow with a hairline (was a pale amber). Affects Settings (temporary password notice) and the room banners.
- Button radii are now expressed through a `shape` variant; `default` keeps the old 10/12px look.

### Unchanged on purpose

`--soft-bg`, card radius 16px / `shadow-soft`, gradients, purple focus ring, `Badge` colours.

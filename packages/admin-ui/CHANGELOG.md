# Changelog — @recap/admin-ui

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

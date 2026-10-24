# Changelog — @recap/admin-ui

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

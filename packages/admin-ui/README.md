# @recap/admin-ui

"Soft" admin UI kit: React 19 + Tailwind 4, shadcn-style (copied primitives, Radix behaviour, `cva` + `tailwind-merge`). No domain knowledge: brand, nav, user and data come in as props. Ships TypeScript source (no build step).

## Install / import
Workspace package. In the host app:

```jsonc
// package.json
"dependencies": { "@recap/admin-ui": "*" }
```
```ts
// next.config.ts
transpilePackages: ["@recap/admin-ui"]
```
```css
/* globals.css */
@import "tailwindcss";
@import "@recap/admin-ui/theme.css"; /* tokens, @theme mapping, and @source for the kit's classes */
```
Copying to another project: copy `packages/admin-ui`, keep the three lines above; peer deps are `react`/`react-dom` 19.

## Fonts
The kit does not load fonts. Load Be Vietnam Pro (400/600/700, `vietnamese` subset) and JetBrains Mono, then point the tokens at them, e.g. with `next/font`:
```css
:root { --soft-font-sans: var(--font-be-vietnam), system-ui, sans-serif; --soft-font-mono: var(--font-jetbrains), ui-monospace, monospace; }
```
System fallbacks are used otherwise. `AppShell` applies the font; pages outside it add `font-soft`.

## Tokens (`src/theme.css`)
All prefixed `--soft-*` (no clash with app tokens). Colour utilities: `bg-soft-bg|surface|fill`, `text-soft-ink|muted|brand|ok|bad`, `border-soft-line`; amber conclusion tokens `soft-conclusion(-bg)`. Gradients as utilities `bg-soft-main|dark|blue|orange|green|red`, `text-soft-gradient`. Radius `rounded-soft` (16px). Shadows `shadow-soft`, `shadow-soft-sm`, `shadow-soft-tile`, `shadow-soft-pop`. Fonts `font-soft`, `font-soft-mono`. Helpers `soft-tabular`, `soft-focus`. Categorical chart colours `--soft-chart-1..5`. Dark: `<html data-theme="dark">` (neutral stub, light is the reference).

## App shell
```tsx
<AppShell
  brand={{ name: "Biên bản", subtitle: "Quản trị", icon: <FileText /> }}
  nav={[{ items: [{ label: "Tổng quan", href: "/", icon: <House /> }] },
        { label: "Quản trị", items: [{ label: "Mức sử dụng", href: "/usage", icon: <ChartBar />, badge: 3 }] }]}
  currentPath={pathname}            // usePathname(); longest-prefix match picks the active item
  linkComponent={Link}              // next/link; default <a>
  sidebarFooter={<SidebarHelpCard title="Cần trợ giúp?" action={<HelpCardAction href="/docs">Xem tài liệu</HelpCardAction>} />}
  userMenu={<DropdownMenu trigger={<button>…</button>} items={[…]} />}
>
  <PageHeader breadcrumb={["Quản trị", "Tổng quan"]} title={<>Tổng quan <GradientText>tháng 10</GradientText></>} actions={…} />
  …
</AppShell>
```
Props: `brand`, `nav: NavGroup[]`, `currentPath`, `linkComponent`, `sidebarFooter`, `userMenu`, `topbarActions`, `header` (optional PageHeader props), `collapsible`/`collapsed`/`defaultCollapsed`/`onCollapsedChange` (icon rail; persistence is the host's), `defaultDrawerOpen`, `labels` (override Vietnamese strings, see `defaultLabels`). Below 860px the sidebar is a drawer: sticky topbar with a menu button (`aria-expanded`/`aria-controls`), Escape / scrim / link click closes, focus returns to the button, skip link included. `NavItemConfig`: `label, href, icon, badge, active, disabled, exact`.

## Components
v2 (0.2.0, see CHANGELOG.md): `FloatCard` · `PillTabs` · `Chip` · `IconBadge` · `Bubble` · `FloatingActionBar` · `StatTile`; `Banner` `onDismiss`/`radius`, `SegmentedControl variant="soft"`, `LevelMeter variant="compact"`, `Button shape="pill"`.

`Card, CardHeader, CardLink` · `StatCard` (`label, value, unit, delta, deltaLabel, icon, tone, progress`) · `MiniStat` · `Button` (`variant: primary|outline|tonal|plain|ghost|danger`, `size: sm|md|lg|icon|icon-sm`, `icon`, `loading`, `asChild`) · `IconButton` (`label`, `icon`, `size: sm|md`, `tone`; `iconButtonVariants` for links) · `Banner` (`tone: info|success|warn|error`, `layout: card|bar`, `icon`, `action`) · `Kbd` · `LevelMeter` (`value`, `bars`, `label`, `disabled`) · `IconTile` (`tone: main|blue|orange|green|red|dark`, `size`) · `Badge` (`variant: neutral|ok|rec|warn|error|purple|cyan|conclusion`, `shape: pill|chip`, `dot`), `Pill` · `StatusDot` · `ProgressBar` (`value, max, tone|color, size, marker, label`) · `SegmentedControl` (`options, value, onValueChange, ariaLabel, variant: pill|tabs, size: sm|md, fill`) · `Select` (Radix; `options, ariaLabel, prefix`) · `DropdownMenu` · `Tabs/TabsList/TabsTrigger/TabsContent` · `DataTable` (`columns` with `numeric, sortable, sortValue, highlight, cell`; `rows, rowKey, footer, defaultSort|sort, empty, caption`) · `Tooltip` · `Dialog` (`title, description, footer, error, busy, size: sm|md|lg`) · `ConfirmDialog` (`confirmLabel, cancelLabel, destructive`, async `onConfirm`; failures stay in the dialog) · `Field` (`label, optional, hint, error`), `Input`, `Textarea`, `Label` · `LoginForm` (`onSubmit({email,password,remember})`, `loading`, `error`, `logo`, `title`, `footer`) · `EmptyState` · `Skeleton`.

## Charts
Plain props, responsive (ResizeObserver; `initialWidth` for SSR), `role="img"` + `ariaLabel`, a screen-reader data table, hover tooltip and keyboard cursor (Arrow keys / Home / End / Esc).
- `LineAreaChart` `{ series: {id,label,values,color,axis?:"left"|"right",area?,areaOpacity?,formatValue?}[], labels, ariaLabel, axis?:{left?,right?:{max?,format?}}, formatValue, height, tickCount }` — monotone curve that never overshoots the data.
- `StackedBarChart` `{ series, labels, ariaLabel, variant?: "bars"|"area", formatValue, formatAxis, max, showLegend }`.
- `NavyBarCard` `{ title, subtitle, values, labels, ariaLabel, formatValue }` — put inside a `Card` or use alone.
- `Sparkline` `{ values, color, width, height, ariaLabel? }`.

## Helpers
`formatNumber` (`1.234,5`), `formatCompact` (`6,59 triệu`), `formatUsd`, `formatPercent`, `formatDelta(cur, prev) -> {text, direction}`, `formatDuration(sec, "long"|"clock")`, `formatMs`; `niceAxis`, `linearScale`, `smoothLinePath/AreaPath/BandPath` (Fritsch-Carlson), `sortRows`, `resolveActiveItem`, `cn`.

## Preview and tests
`npm run preview -w @recap/admin-ui` writes static pages (dashboard, usage, kit, login, mobile, drawer) with compiled CSS to `data/admin-ui-preview/` (open in a browser; no JS, overlays closed). `npx vitest run --project admin-ui`; typecheck: `npm run typecheck -w @recap/admin-ui` (the root tsconfig excludes this package because it needs JSX + DOM libs).

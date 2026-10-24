/**
 * @recap/admin-ui — "Soft" admin UI kit (React 19 + Tailwind 4). See README.md.
 * Import `@recap/admin-ui/theme.css` once from the app's global CSS.
 */
export { cn } from "./lib/cn";
export { defaultLabels, type Labels } from "./labels";

// Formatting + pure helpers
export {
  formatNumber,
  formatCompact,
  formatUsd,
  formatUsdAxis,
  formatPercent,
  formatDelta,
  formatDuration,
  formatMs,
  type DeltaInfo,
  type DeltaDirection,
  type DurationStyle,
} from "./lib/format";
export {
  niceAxis,
  niceStep,
  stepDecimals,
  linearScale,
  labelIndices,
  nearestIndex,
  stepIndex,
  type NiceAxis,
} from "./lib/scale";
export {
  monotoneSegments,
  smoothLinePath,
  smoothAreaPath,
  smoothBandPath,
  type Point,
  type BezierSegment,
} from "./lib/curve";
export { sortRows, nextSort, type SortState, type SortDirection } from "./lib/sort";

// Primitives
export {
  Card,
  CardHeader,
  CardLink,
  type CardProps,
  type CardHeaderProps,
} from "./components/card";
export { StatCard, MiniStat, type StatCardProps, type MiniStatProps } from "./components/stat-card";
export { Button, type ButtonProps } from "./components/button";
export { buttonVariants } from "./components/button-variants";
export {
  ActionGroup,
  actionGroupVariants,
  type ActionGroupProps,
  type ActionPlacement,
} from "./components/action-group";
export { IconTile, type IconTileProps } from "./components/icon-tile";
export { Badge, Pill, type BadgeProps } from "./components/badge";
export { StatusDot, type StatusDotProps } from "./components/status-dot";
export { ProgressBar, type ProgressBarProps } from "./components/progress-bar";
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentOption,
} from "./components/segmented-control";
export { Select, type SelectProps, type SelectOption } from "./components/select";
export {
  DropdownMenu,
  type DropdownMenuProps,
  type DropdownItem,
} from "./components/dropdown-menu";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs";
export { DataTable, type DataTableProps, type DataColumn } from "./components/data-table";
export { Tooltip, type TooltipProps } from "./components/tooltip";
export { Dialog, type DialogProps } from "./components/dialog";
export {
  ConfirmDialog,
  confirmErrorMessage,
  type ConfirmDialogProps,
} from "./components/confirm-dialog";
export { Banner, type BannerProps } from "./components/banner";
export { FloatCard, type FloatCardProps } from "./components/float-card";
export {
  PillTabs,
  pillTabId,
  pillTabPanelId,
  type PillTab,
  type PillTabsProps,
} from "./components/pill-tabs";
export { Chip, chipVariants, type ChipProps } from "./components/chip";
export { IconBadge, type IconBadgeProps } from "./components/icon-badge";
export { Bubble, bubbleClasses, type BubbleProps, type BubbleTone } from "./components/bubble";
export { FloatingActionBar, type FloatingActionBarProps } from "./components/floating-action-bar";
export { StatTile, type StatTileProps } from "./components/stat-tile";
export {
  ROW_TONE_SURFACE,
  ROW_TONE_CHIP,
  ROW_TONE_INK,
  ROW_TONE_BAR,
  type RowTone,
} from "./components/tone-ab";
export { nextTabIndex, resolveSelectedTab, isTabNavKey, type TabNavKey } from "./lib/tab-nav";
export { IconButton, type IconButtonProps } from "./components/icon-button";
export { iconButtonVariants } from "./components/icon-button-variants";
export { Kbd } from "./components/kbd";
export { LevelMeter, type LevelMeterProps } from "./components/level-meter";
export {
  Field,
  Input,
  Textarea,
  Label,
  useFieldControl,
  type FieldProps,
  type InputProps,
  type TextareaProps,
} from "./components/field";
export { LoginForm, type LoginFormProps, type LoginValues } from "./components/login-form";
export { EmptyState, type EmptyStateProps } from "./components/empty-state";
export { Skeleton } from "./components/skeleton";
export { TONE_BG, TONE_GRADIENT, type Tone } from "./components/tone";

// Shell
export { AppShell, type AppShellProps } from "./shell/app-shell";
export {
  Sidebar,
  SidebarHelpCard,
  HelpCardAction,
  type SidebarProps,
  type SidebarHelpCardProps,
} from "./shell/sidebar";
export { NavItem } from "./shell/nav-item";
export { PageHeader, GradientText, type PageHeaderProps, type Crumb } from "./shell/page-header";
export { matchesPath, resolveActiveItem } from "./shell/active";
export type { NavGroup, NavItemConfig, BrandConfig, ShellLinkComponent } from "./shell/types";

// Charts
export {
  LineAreaChart,
  type LineAreaChartProps,
  type LineSeries,
  type AxisConfig,
} from "./charts/line-area-chart";
export {
  StackedBarChart,
  type StackedBarChartProps,
  type StackSeries,
} from "./charts/stacked-bar-chart";
export { NavyBarCard, type NavyBarCardProps } from "./charts/navy-bar-card";
export { Sparkline, type SparklineProps } from "./charts/sparkline";
export { ChartLegend, type LegendItem } from "./charts/chart-parts";

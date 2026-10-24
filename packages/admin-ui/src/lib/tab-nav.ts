export type TabNavKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";

const KEYS: ReadonlySet<string> = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

export function isTabNavKey(key: string): key is TabNavKey {
  return KEYS.has(key);
}

/**
 * Index of the tab to move focus to for a keyboard key, skipping disabled tabs and wrapping around.
 * Returns `current` when nothing else is reachable, `-1` when every tab is disabled.
 */
export function nextTabIndex(
  disabled: ReadonlyArray<boolean>,
  current: number,
  key: TabNavKey,
): number {
  const count = disabled.length;
  const first = disabled.findIndex((d) => !d);
  if (count === 0 || first === -1) return -1;
  if (key === "Home") return first;
  if (key === "End") return disabled.lastIndexOf(false);
  const step = key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1;
  for (let hop = 1; hop <= count; hop += 1) {
    const candidate = (((current + step * hop) % count) + count) % count;
    if (!disabled[candidate]) return candidate;
  }
  return current;
}

/** Selected tab id: the controlled value wins, otherwise the first enabled tab. */
export function resolveSelectedTab(
  tabs: ReadonlyArray<{ id: string; disabled?: boolean }>,
  value: string | undefined,
): string | undefined {
  const match = tabs.find((t) => t.id === value && !t.disabled);
  return (match ?? tabs.find((t) => !t.disabled))?.id;
}

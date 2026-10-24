import type { NavGroup, NavItemConfig } from "./types";

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function pathOf(href: string): string {
  const cut = href.search(/[?#]/);
  return stripTrailingSlash(cut === -1 ? href : href.slice(0, cut));
}

/** Does `pathname` belong to the nav item `href`? (`/` and `exact` items match exactly, others by segment prefix.) */
export function matchesPath(pathname: string, href: string, exact = false): boolean {
  const here = stripTrailingSlash(pathname);
  const target = pathOf(href);
  if (here === target) return true;
  if (exact || target === "/") return false;
  return here.startsWith(`${target}/`);
}

/**
 * The single item that should be active for `pathname`: the longest matching href wins, so
 * `/meetings/new` beats `/meetings`. Items with an explicit `active` flag win over matching.
 */
export function resolveActiveItem(
  groups: ReadonlyArray<NavGroup>,
  pathname: string | undefined,
): NavItemConfig | undefined {
  const all = groups.flatMap((g) => g.items);
  const forced = all.find((i) => i.active);
  if (forced) return forced;
  if (pathname === undefined) return undefined;
  let best: NavItemConfig | undefined;
  for (const item of all) {
    if (item.disabled || !matchesPath(pathname, item.href, item.exact)) continue;
    if (!best || pathOf(item.href).length > pathOf(best.href).length) best = item;
  }
  return best;
}

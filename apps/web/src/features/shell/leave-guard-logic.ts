/** The parts of a click and of the clicked anchor that decide whether it leaves the page. */
export interface ClickInfo {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface AnchorInfo {
  href: string;
  target: string;
  download: boolean;
}

const PRIMARY_BUTTON = 0;

function isPlainPrimaryClick(click: ClickInfo): boolean {
  if (click.defaultPrevented || click.button !== PRIMARY_BUTTON) return false;
  return !(click.metaKey || click.ctrlKey || click.shiftKey || click.altKey);
}

/**
 * The in-app URL (path + search + hash) a click would navigate to, or null when it does not leave
 * the current page: modified clicks (new tab), other targets, downloads, other origins and links
 * that only change the hash of the current page.
 */
export function leaveTargetFromClick(
  click: ClickInfo,
  anchor: AnchorInfo,
  currentHref: string,
): string | null {
  if (!isPlainPrimaryClick(click)) return null;
  if (anchor.download || (anchor.target !== "" && anchor.target !== "_self")) return null;
  const current = new URL(currentHref);
  let target: URL;
  try {
    target = new URL(anchor.href, current);
  } catch {
    return null;
  }
  if (target.origin !== current.origin) return null;
  if (target.pathname === current.pathname && target.search === current.search) return null;
  return `${target.pathname}${target.search}${target.hash}`;
}

/** Same page as the one the guard protects (popstate fired by a hash change, not by leaving). */
export function isSamePage(aHref: string, bHref: string): boolean {
  const a = new URL(aHref);
  const b = new URL(bHref);
  return a.origin === b.origin && a.pathname === b.pathname && a.search === b.search;
}

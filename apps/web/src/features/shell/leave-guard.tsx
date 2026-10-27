"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmDialog } from "@recap/admin-ui";
import { isSamePage, leaveTargetFromClick } from "./leave-guard-logic";

/** What the guarded page provides: how to end its live session before the app navigates away. */
export interface LeaveRegistration {
  endSession: () => void;
}

type Register = (registration: LeaveRegistration | null) => void;

const LeaveGuardContext = createContext<Register>(() => undefined);

/**
 * While a page is registered (a live recording), every way of leaving asks first:
 * - clicks on any in-app link (sidebar, buttons, user menu) are caught in the capture phase on
 *   `document`, before React/Next see them, so it does not matter which component rendered the link;
 * - browser back/forward is caught on `popstate` (capture, stopImmediatePropagation so Next's own
 *   handler never navigates), then the current entry is pushed again to stay in place;
 * - closing / reloading the tab uses `beforeunload` (the browser shows its own generic text).
 * Next 16 has no router events, so there is no official hook for the first two.
 */
export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const registration = useRef<LeaveRegistration | null>(null);
  const [active, setActive] = useState(false);
  const [target, setTarget] = useState<string | null>(null);

  const register = useCallback<Register>((next) => {
    registration.current = next;
    setActive(next !== null);
    if (!next) setTarget(null);
  }, []);

  useGuardListeners(active, setTarget);

  const confirmLeave = useCallback(() => {
    const destination = target;
    registration.current?.endSession();
    setTarget(null);
    if (destination) router.push(destination);
  }, [target, router]);

  return (
    <LeaveGuardContext.Provider value={register}>
      {children}
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title="Cuộc họp đang ghi"
        description="Rời khỏi phòng sẽ dừng ghi và kết thúc phiên. Bản ghi và bản dịch đã có vẫn được giữ lại."
        confirmLabel="Kết thúc và rời đi"
        cancelLabel="Ở lại phòng"
        destructive
        onConfirm={confirmLeave}
      />
    </LeaveGuardContext.Provider>
  );
}

function useGuardListeners(active: boolean, askToLeave: (href: string) => void) {
  useEffect(() => {
    if (!active) return;
    const anchorHref = window.location.href;
    const anchorState: unknown = window.history.state;

    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = leaveTargetFromClick(
        event,
        { href: anchor.href, target: anchor.target, download: anchor.hasAttribute("download") },
        window.location.href,
      );
      if (href === null) return;
      event.preventDefault();
      event.stopPropagation();
      askToLeave(href);
    };
    const onPopState = (event: PopStateEvent) => {
      if (isSamePage(window.location.href, anchorHref)) return;
      event.stopImmediatePropagation();
      const destination = window.location.pathname + window.location.search;
      window.history.pushState(anchorState, "", anchorHref);
      askToLeave(destination);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active, askToLeave]);
}

/** Guards the page while `active`. `endSession` must be safe to call right before navigation. */
export function useLeaveGuard(active: boolean, endSession: () => void): void {
  const register = useContext(LeaveGuardContext);
  const latest = useRef(endSession);
  useEffect(() => {
    latest.current = endSession;
  }, [endSession]);
  const registration = useMemo<LeaveRegistration>(
    () => ({ endSession: () => latest.current() }),
    [],
  );
  useEffect(() => {
    if (!active) return;
    register(registration);
    return () => register(null);
  }, [active, register, registration]);
}

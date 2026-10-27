"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { buildSelectionDraft, type Box, type SelectionDraft } from "./selection-note";

/** Selection changes (touch handles, keyboard) are read after this pause. */
const SETTLE_MS = 180;
const ROW_SELECTOR = "[data-seg-row]";

export interface TranscriptSelection {
  draft: SelectionDraft;
  first: Box;
  last: Box;
  /** Identity of the selection, so a used one is not offered again. */
  key: string;
}

const toBox = (r: DOMRect): Box => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });

/** The segment row the range starts in; else the first rendered row the range touches. */
function startRow(range: Range, root: HTMLElement): HTMLElement | null {
  const node = range.startContainer;
  const el = node instanceof Element ? node : node.parentElement;
  const own = el?.closest<HTMLElement>(ROW_SELECTOR);
  if (own && root.contains(own)) return own;
  const rows = root.querySelectorAll<HTMLElement>(ROW_SELECTOR);
  return Array.from(rows).find((row) => range.intersectsNode(row)) ?? null;
}

/** Reads the browser selection; null when collapsed, empty or not inside the transcript. */
export function readTranscriptSelection(root: HTMLElement): TranscriptSelection | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  const draft = buildSelectionDraft(sel.toString(), startRow(range, root)?.dataset.startMs);
  if (!draft) return null;
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 || r.height > 0);
  const first = rects[0] ?? range.getBoundingClientRect();
  const last = rects[rects.length - 1] ?? first;
  return { draft, first: toBox(first), last: toBox(last), key: `${draft.atMs}|${draft.content}` };
}

interface Handlers {
  evaluate: () => void;
  dismiss: () => void;
  hide: () => void;
}

/** DOM listeners: read on pointer release / settle, hide on scroll and blur, dismiss on Escape. */
function useSelectionListeners(rootRef: RefObject<HTMLElement | null>, h: Handlers) {
  const { evaluate, dismiss, hide } = h;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pointerDown = false;
    const settle = () => {
      clearTimeout(timer);
      if (!pointerDown) timer = setTimeout(evaluate, SETTLE_MS);
    };
    const down = () => {
      pointerDown = true;
    };
    const up = () => {
      pointerDown = false;
      settle();
    };
    const key = (e: KeyboardEvent) => (e.key === "Escape" ? dismiss() : settle());
    const root = rootRef.current;
    document.addEventListener("selectionchange", settle);
    document.addEventListener("mousedown", down);
    document.addEventListener("mouseup", up);
    document.addEventListener("touchend", up);
    document.addEventListener("keyup", key);
    window.addEventListener("blur", hide);
    root?.addEventListener("scroll", hide, { passive: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", settle);
      document.removeEventListener("mousedown", down);
      document.removeEventListener("mouseup", up);
      document.removeEventListener("touchend", up);
      document.removeEventListener("keyup", key);
      window.removeEventListener("blur", hide);
      root?.removeEventListener("scroll", hide);
    };
  }, [rootRef, evaluate, dismiss, hide]);
}

/**
 * Tracks a non-collapsed selection inside `rootRef`. It is read once the pointer is released
 * (or the selection settles, for touch handles and shift+arrows) and cleared on scroll, Escape,
 * window blur and `dismiss()`. A dismissed selection is not offered again until it changes.
 */
export function useTranscriptSelection(rootRef: RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TranscriptSelection | null>(null);
  const dismissed = useRef<string | null>(null);

  const evaluate = useCallback(() => {
    const root = rootRef.current;
    const next = root ? readTranscriptSelection(root) : null;
    if (!next) dismissed.current = null;
    setSelection(next && next.key !== dismissed.current ? next : null);
  }, [rootRef]);

  const dismiss = useCallback(() => {
    setSelection((current) => {
      if (current) dismissed.current = current.key;
      return null;
    });
  }, []);

  const hide = useCallback(() => setSelection(null), []);
  useSelectionListeners(rootRef, { evaluate, dismiss, hide });
  return { selection, dismiss };
}

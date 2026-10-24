"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { TranscriptHitDto } from "@/lib/api-types";
import { searchTranscript } from "@/lib/api-transcript";
import {
  initialSearchState,
  searchReducer,
  type SearchAction,
  type SearchState,
} from "./search-state";

const TYPING_DEBOUNCE_MS = 250;
/** Live meetings: re-run quietly when new segments arrived. */
const REFRESH_DEBOUNCE_MS = 1500;

export interface TranscriptSearchApi {
  state: SearchState;
  dispatch: (action: SearchAction) => void;
  retry: () => void;
  /** The hit the transcript should show now, with a nonce that changes per request to show it. */
  current: TranscriptHitDto | undefined;
}

/** Debounced, abortable search over one meeting; `version` changes when the transcript grew. */
export function useTranscriptSearch(meetingId: string, version: number): TranscriptSearchApi {
  const [state, dispatch] = useReducer(searchReducer, initialSearchState);
  const [retryKey, setRetryKey] = useState(0);
  const lastQuery = useRef("");
  const { query } = state;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === "") {
      lastQuery.current = "";
      return;
    }
    const typing = lastQuery.current !== query;
    lastQuery.current = query;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        searchTranscript(meetingId, trimmed, controller.signal)
          .then((result) => dispatch({ type: "results", query, result }))
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === "AbortError") return;
            dispatch({ type: "failed", query });
          });
      },
      typing ? TYPING_DEBOUNCE_MS : REFRESH_DEBOUNCE_MS,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [meetingId, query, version, retryKey]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);
  return { state, dispatch, retry, current: state.hits[state.active] };
}

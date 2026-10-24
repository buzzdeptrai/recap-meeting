import type { TranscriptHitDto, TranscriptSearchDto } from "@/lib/api-types";

export type SearchStatus = "idle" | "loading" | "ready" | "error";

export interface SearchState {
  query: string;
  status: SearchStatus;
  hits: TranscriptHitDto[];
  /** Folded query words, for highlighting rows. */
  terms: string[];
  truncated: boolean;
  /** Index of the current hit, -1 for none. */
  active: number;
  /** The hits list is expanded (it collapses when a hit is picked). */
  listOpen: boolean;
  /** Bumped whenever the transcript should scroll to the current hit (even if it did not change). */
  nonce: number;
}

export type SearchAction =
  | { type: "query"; query: string }
  | { type: "results"; query: string; result: TranscriptSearchDto }
  | { type: "failed"; query: string }
  | { type: "step"; delta: 1 | -1 }
  | { type: "select"; index: number }
  | { type: "toggle-list"; open?: boolean }
  | { type: "reset" };

export const initialSearchState: SearchState = {
  query: "",
  status: "idle",
  hits: [],
  terms: [],
  truncated: false,
  active: -1,
  listOpen: true,
  nonce: 0,
};

/** Wraps around: next after the last hit is the first. */
export function stepIndex(active: number, count: number, delta: 1 | -1): number {
  if (count === 0) return -1;
  if (active < 0) return delta === 1 ? 0 : count - 1;
  return (active + delta + count) % count;
}

/** Keeps the current hit when it is still in the refreshed list, else the first. */
function keepActive(previous: SearchState, hits: TranscriptHitDto[]): number {
  if (hits.length === 0) return -1;
  const current = previous.hits[previous.active];
  const same = current ? hits.findIndex((hit) => hit.segmentId === current.segmentId) : -1;
  return same >= 0 ? same : 0;
}

export function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case "query": {
      if (action.query.trim() === "") return { ...initialSearchState, query: action.query };
      return { ...state, query: action.query, status: "loading", listOpen: true };
    }
    case "results": {
      if (action.query !== state.query) return state;
      const { hits, terms, truncated } = action.result;
      const active = keepActive(state, hits);
      const moved = hits[active]?.segmentId !== state.hits[state.active]?.segmentId;
      const nonce = moved && active >= 0 ? state.nonce + 1 : state.nonce;
      return { ...state, status: "ready", hits, terms, truncated, active, nonce };
    }
    case "failed":
      return action.query === state.query
        ? { ...state, status: "error", hits: [], active: -1 }
        : state;
    case "step":
      return {
        ...state,
        active: stepIndex(state.active, state.hits.length, action.delta),
        listOpen: false,
        nonce: state.nonce + 1,
      };
    case "select":
      return { ...state, active: action.index, listOpen: false, nonce: state.nonce + 1 };
    case "toggle-list":
      return { ...state, listOpen: action.open ?? !state.listOpen };
    case "reset":
      return initialSearchState;
  }
}

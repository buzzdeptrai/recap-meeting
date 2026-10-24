import type { Channel, ErrorMessage, Mark, Segment, ServerMessage, SttState } from "@recap/core";
import type {
  MarkAnchorDto,
  SegmentsPageDto,
  TranscriptStatsDto,
  TranslationDto,
} from "@/lib/api-types";
import { countWords } from "./marks";
import {
  extendWindow,
  isAtTail,
  isCurrentPage,
  mergeSegments,
  mergeTranslations,
  windowOf,
  type PageDirection,
  type RoomWindow,
} from "./paging";

export interface InterimLine {
  text: string;
  startMs: number;
  endMs: number;
}

export interface TranslationView {
  lang: TranslationDto["lang"];
  text: string;
  provider: string;
}

export interface RoomState {
  /** The loaded run of the transcript, ordered by `seq`, unique by id (not always all of it). */
  segments: Segment[];
  /** Which part of the meeting `segments` covers. */
  window: RoomWindow;
  /** Whole-meeting counters (the window is only a part). */
  stats: TranscriptStatsDto;
  /** Conclusion mark id -> its segment, so the rail needs no loaded segments. */
  markAnchors: Record<string, MarkAnchorDto>;
  /** Live segments that arrived while the window was not the tail; merged once it reaches it. */
  pendingLive: Segment[];
  /** `seq` of the first segment that arrived over the socket (those fade in); null before any. */
  liveFromSeq: number | null;
  /** Keyed by segmentId; may arrive before its segment. */
  translations: Record<string, TranslationView>;
  /** Ordered by atMs, unique by id. */
  marks: Mark[];
  interim: Record<Channel, InterimLine | null>;
  stt: SttState | null;
  translateProvider: string | null;
  translateDegraded: boolean;
  /** Server ISO start of the meeting; elapsed time = now - startedAt. */
  startedAt: string | null;
  /**
   * Epoch ms at which the meeting timeline was 0 on this client's clock:
   * timeline position now = Date.now() - clockOrigin. Shifts on resume (audio already recorded).
   */
  clockOrigin: number | null;
  /** Latest translation latencies (ms), newest last. */
  latencies: number[];
  lastError: ErrorMessage | null;
}

export type RoomAction =
  | {
      type: "hydrate";
      page: SegmentsPageDto;
      marks: Mark[];
      markAnchors: Record<string, MarkAnchorDto>;
      stats: TranscriptStatsDto;
      startedAt: string | null;
    }
  | { type: "page-loaded"; dir: PageDirection; from: number; page: SegmentsPageDto }
  | { type: "window-replaced"; page: SegmentsPageDto }
  | { type: "server"; message: ServerMessage; receivedAt?: number }
  | { type: "mark-removed"; id: string }
  | { type: "mark-renamed"; id: string; label: string }
  | { type: "clear-error" };

const LATENCY_WINDOW = 20;

export const initialRoomState: RoomState = {
  segments: [],
  window: { prevCursor: null, nextCursor: null },
  stats: { segments: 0, words: 0, translated: 0 },
  markAnchors: {},
  pendingLive: [],
  liveFromSeq: null,
  translations: {},
  marks: [],
  interim: { 0: null, 1: null },
  stt: null,
  translateProvider: null,
  translateDegraded: false,
  startedAt: null,
  clockOrigin: null,
  latencies: [],
  lastError: null,
};

/** Insert or replace by id / seq, keeping the list sorted by seq (appending is the fast path). */
export function upsertSegment(list: Segment[], segment: Segment): Segment[] {
  const last = list.at(-1);
  if (!last || last.seq < segment.seq) return [...list, segment];
  const without = list.filter((item) => item.id !== segment.id && item.seq !== segment.seq);
  return [...without, segment].sort((a, b) => a.seq - b.seq);
}

export function upsertMark(list: Mark[], mark: Mark): Mark[] {
  const next = [...list.filter((item) => item.id !== mark.id), mark];
  return next.sort((a, b) => a.atMs - b.atMs);
}

const toView = ({ lang, text, provider }: TranslationDto): TranslationView => ({
  lang,
  text,
  provider,
});

/** Server pages are already ordered; this only guards the invariant (cheap for ~200 rows). */
const sortedUnique = (list: Segment[]): Segment[] => list.reduce(upsertSegment, [] as Segment[]);

const toViews = (items: TranslationDto[]) => mergeTranslations<TranslationView>({}, items, toView);

function hydrate(state: RoomState, action: Extract<RoomAction, { type: "hydrate" }>): RoomState {
  return {
    ...state,
    segments: sortedUnique(action.page.segments),
    window: windowOf(action.page),
    translations: toViews(action.page.translations),
    stats: action.stats,
    markAnchors: action.markAnchors,
    marks: action.marks.reduce(upsertMark, [] as Mark[]),
    startedAt: action.startedAt ?? state.startedAt,
    clockOrigin: action.startedAt ? Date.parse(action.startedAt) : state.clockOrigin,
  };
}

/** Live segments held back while elsewhere in the meeting join the run once it reaches the tail. */
function withPending(state: RoomState, segments: Segment[], window: RoomWindow) {
  if (!isAtTail(window) || state.pendingLive.length === 0) {
    return { segments, pendingLive: state.pendingLive };
  }
  return { segments: mergeSegments(segments, state.pendingLive), pendingLive: [] };
}

function pageLoaded(state: RoomState, action: Extract<RoomAction, { type: "page-loaded" }>) {
  if (!isCurrentPage(state.window, action.dir, action.from)) return state;
  const window = extendWindow(state.window, action.dir, action.page);
  const merged = mergeSegments(state.segments, action.page.segments);
  return {
    ...state,
    ...withPending(state, merged, window),
    window,
    translations: mergeTranslations(state.translations, action.page.translations, toView),
  };
}

function windowReplaced(state: RoomState, page: SegmentsPageDto): RoomState {
  const window = windowOf(page);
  return {
    ...state,
    ...withPending(state, sortedUnique(page.segments), window),
    window,
    translations: toViews(page.translations),
    stats: { ...state.stats, segments: Math.max(state.stats.segments, page.total) },
  };
}

/** A finished segment from the socket: always counted, appended only when the window is the tail. */
function segmentArrived(state: RoomState, segment: Segment): RoomState {
  const appended = isAtTail(state.window);
  const segments = appended ? upsertSegment(state.segments, segment) : state.segments;
  const pendingLive = appended ? state.pendingLive : upsertSegment(state.pendingLive, segment);
  const known = appended
    ? segments.length === state.segments.length
    : pendingLive.length === state.pendingLive.length;
  return {
    ...state,
    segments,
    pendingLive,
    liveFromSeq: state.liveFromSeq ?? segment.seq,
    stats: known
      ? state.stats
      : {
          ...state.stats,
          segments: state.stats.segments + 1,
          words: state.stats.words + countWords(segment.text),
        },
    interim: { ...state.interim, [segment.channel]: null },
  };
}

/** Timeline origin on the client clock: when `ready` arrived, minus audio already recorded. */
export function clockOriginAt(
  receivedAt: number | undefined,
  baseMs: number | undefined,
  startedAt: string,
) {
  return receivedAt === undefined ? Date.parse(startedAt) : receivedAt - (baseMs ?? 0);
}

export function removeMark(list: Mark[], id: string): Mark[] {
  return list.filter((mark) => mark.id !== id);
}

export function renameMark(list: Mark[], id: string, label: string): Mark[] {
  const next = label.trim() || null;
  return list.map((mark) => (mark.id === id ? { ...mark, label: next } : mark));
}

function applyServer(state: RoomState, message: ServerMessage, receivedAt?: number): RoomState {
  switch (message.type) {
    case "ready":
      return {
        ...state,
        startedAt: message.startedAt,
        clockOrigin: clockOriginAt(receivedAt, message.baseMs, message.startedAt),
        lastError: null,
      };
    case "status":
      return {
        ...state,
        stt: message.stt,
        translateProvider: message.translate.provider,
        translateDegraded: message.translate.degraded,
      };
    case "interim":
      return {
        ...state,
        interim: { ...state.interim, [message.channel]: message.text ? message : null },
      };
    case "segment":
      return segmentArrived(state, message.segment);
    case "translation":
      return {
        ...state,
        translations: { ...state.translations, [message.segmentId]: toView({ ...message }) },
        stats:
          message.segmentId in state.translations
            ? state.stats
            : { ...state.stats, translated: state.stats.translated + 1 },
        latencies: [...state.latencies, message.latencyMs].slice(-LATENCY_WINDOW),
      };
    case "mark":
      return { ...state, marks: upsertMark(state.marks, message.mark) };
    case "unmark":
      return { ...state, marks: removeMark(state.marks, message.id) };
    case "error":
      return { ...state, lastError: message };
    default:
      return state;
  }
}

export function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case "hydrate":
      return hydrate(state, action);
    case "page-loaded":
      return pageLoaded(state, action);
    case "window-replaced":
      return windowReplaced(state, action.page);
    case "server":
      return applyServer(state, action.message, action.receivedAt);
    case "mark-removed":
      return { ...state, marks: removeMark(state.marks, action.id) };
    case "mark-renamed":
      return { ...state, marks: renameMark(state.marks, action.id, action.label) };
    case "clear-error":
      return { ...state, lastError: null };
  }
}

export function averageLatencyMs(latencies: number[]): number | null {
  if (latencies.length === 0) return null;
  return latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
}

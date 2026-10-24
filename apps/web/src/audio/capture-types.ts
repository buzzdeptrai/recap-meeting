/** Source states: lifecycle (ok/missing/ended/denied) plus "live track but no sound" (silent/lost). */
export type TabState = "ok" | "missing" | "ended" | "silent";
export type MicState = "ok" | "denied" | "ended" | "silent" | "lost";

export interface SourceStatus {
  tab: TabState;
  mic: MicState;
  /**
   * Present (true) only while the mic re-captures the speakers. Advisory: it never changes
   * `tab`/`mic` and is only set while both are "ok".
   */
  echo?: boolean;
}

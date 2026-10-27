import type { SttChannelState, SttResult, SttStatus } from "../types";

export interface ChannelCallbacks {
  onResult: (isFinal: boolean, result: SttResult) => void;
  onStatus: (status: SttStatus) => void;
  /** Non-fatal vendor error text. */
  onError: (message: string) => void;
  /** The channel gave up reconnecting. */
  onFatal: (message: string) => void;
  /** Idle = the channel is parked (socket closed or about to be) and must not count for status. */
  onIdleChange: (idle: boolean) => void;
  onActivity: (state: SttChannelState) => void;
}

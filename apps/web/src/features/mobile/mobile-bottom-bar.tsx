"use client";

import { Flag, Microphone, Stop, Sparkle } from "@phosphor-icons/react";
import { Button } from "@recap/admin-ui";
import {
  CONTINUE_RECORDING_LABEL,
  MARK_CONCLUSION_LABEL,
  MARK_TOPIC_LABEL,
  START_LABEL,
  STOP_LABEL,
} from "./mobile-copy";

const BAR_CLASS =
  "shrink-0 border-t border-soft-line-strong bg-soft-surface px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]";
const BIG_BUTTON = "h-14 w-full text-base";

interface RecordingBarProps {
  canMark: boolean;
  onConclusion: () => void;
  onTopic: () => void;
  onStop: () => void;
}

/** While recording: conclusion (K), new topic (T) and stop, each a 56 px target. */
export function RecordingBar({ canMark, onConclusion, onTopic, onStop }: RecordingBarProps) {
  return (
    <div className={BAR_CLASS}>
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          className={BIG_BUTTON}
          icon={<Sparkle size={20} weight="fill" />}
          disabled={!canMark}
          onClick={onConclusion}
        >
          {MARK_CONCLUSION_LABEL}
        </Button>
        <Button
          variant="outline"
          className={BIG_BUTTON}
          icon={<Flag size={20} />}
          disabled={!canMark}
          onClick={onTopic}
        >
          {MARK_TOPIC_LABEL}
        </Button>
        <Button
          variant="danger"
          className={BIG_BUTTON}
          icon={<Stop size={20} weight="fill" />}
          onClick={onStop}
        >
          {STOP_LABEL}
        </Button>
      </div>
    </div>
  );
}

interface StartBarProps {
  resuming: boolean;
  loading: boolean;
  onStart: () => void;
}

/** Before recording (or to continue after stopping): one big button. */
export function StartBar({ resuming, loading, onStart }: StartBarProps) {
  return (
    <div className={BAR_CLASS}>
      <Button
        className="h-16 w-full text-base"
        icon={<Microphone size={22} weight="fill" />}
        loading={loading}
        onClick={onStart}
      >
        {resuming ? CONTINUE_RECORDING_LABEL : START_LABEL}
      </Button>
    </div>
  );
}

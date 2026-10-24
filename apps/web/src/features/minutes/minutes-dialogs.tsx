"use client";

import { useState } from "react";
import type { MinutesLang } from "@recap/core";
import { ConfirmDialog } from "@recap/admin-ui";
import { describeConfirm, type Confirm } from "./minutes-confirm";
import { SourceLangPicker } from "./source-lang-picker";

interface MinutesConfirmProps {
  confirm: Confirm | null;
  /** Language of the open tab (the default source when regenerating). */
  lang: MinutesLang;
  otherExists: boolean;
  onClose: () => void;
  onRegenerate: (sourceLang: MinutesLang) => void;
  onRetranslate: () => void;
  onSwitchLang: (lang: MinutesLang) => void;
  onRemoveTopic: (id: string) => void;
}

/** Keeps the last copy while the dialog fades out, so the title never flashes empty. */
export function MinutesConfirm(props: MinutesConfirmProps) {
  const { confirm, lang, otherExists, onClose } = props;
  const [shown, setShown] = useState<Confirm | null>(confirm);
  const [sourceLang, setSourceLang] = useState<MinutesLang>(lang);
  if (confirm && confirm !== shown) setShown(confirm);
  const copy = shown && describeConfirm(shown, { lang, sourceLang, otherExists });
  const run = () => {
    if (!shown) return;
    if (shown.kind === "regenerate") props.onRegenerate(sourceLang);
    if (shown.kind === "retranslate") props.onRetranslate();
    if (shown.kind === "lang") props.onSwitchLang(shown.lang);
    if (shown.kind === "topic") props.onRemoveTopic(shown.topic.id);
  };
  return (
    <ConfirmDialog
      open={confirm !== null}
      onOpenChange={(open) => !open && onClose()}
      title={copy?.title ?? ""}
      description={copy?.description}
      confirmLabel={copy?.action ?? ""}
      destructive={copy?.destructive ?? false}
      onConfirm={run}
    >
      {shown?.kind === "regenerate" && (
        <SourceLangPicker value={sourceLang} onChange={setSourceLang} />
      )}
    </ConfirmDialog>
  );
}

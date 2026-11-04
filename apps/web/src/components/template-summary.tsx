import { getMeetingTemplate } from "@recap/core";
import { TemplateTag } from "./template-tag";

/** Closed state of an edit surface: caption, type tag and its tagline. */
export function TemplateSummary({ templateId }: { templateId: string }) {
  const tagline = getMeetingTemplate(templateId)?.tagline;
  return (
    <>
      <span className="text-[13px] font-semibold text-soft-ink">Loại cuộc họp</span>
      <TemplateTag templateId={templateId} />
      {tagline && <span className="min-w-0 text-xs text-soft-muted max-sm:hidden">{tagline}</span>}
    </>
  );
}

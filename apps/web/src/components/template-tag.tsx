import { Chip } from "@recap/admin-ui";
import { templateStatus } from "@/lib/status";
import { TemplateIcon } from "./template-icons";

interface TemplateTagProps {
  templateId: string;
  /** Icon only below the `sm` breakpoint (the label stays for screen readers). */
  collapse?: boolean;
  className?: string;
}

/** Meeting type tag (icon + label): the one chip used in the room, minutes header and lists. */
export function TemplateTag({ templateId, collapse = false, className }: TemplateTagProps) {
  const label = templateStatus(templateId).label;
  return (
    <Chip
      tone="info"
      size="md"
      icon={<TemplateIcon id={templateId} />}
      title={label}
      className={`${collapse ? "max-sm:gap-0" : ""} ${className ?? ""}`}
    >
      <span className={collapse ? "max-sm:sr-only" : undefined}>{label}</span>
    </Chip>
  );
}

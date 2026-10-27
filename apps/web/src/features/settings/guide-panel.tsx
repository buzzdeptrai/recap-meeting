import { Card, CardHeader } from "@recap/admin-ui";
import { GUIDE_SECTIONS } from "./guide-content";

export function GuidePanel() {
  return (
    <div className="grid max-w-3xl gap-4">
      {GUIDE_SECTIONS.map((section) => (
        <Card key={section.id} as="section" aria-labelledby={`h-guide-${section.id}`}>
          <CardHeader titleId={`h-guide-${section.id}`} title={section.title} />
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-soft-ink">
            {section.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

import { Card, CardHeader } from "@recap/admin-ui";
import { GuideCallout } from "./guide-callout";
import { GUIDE_SECTIONS, type GuideStep } from "./guide-content";
import { GuideImage } from "./guide-image";

const sectionAnchor = (id: string) => `guide-${id}`;

function GuideStepItem({ step, index }: { step: GuideStep; index: number }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-soft-accent-soft text-xs font-bold text-soft-accent-ink"
      >
        {index + 1}
      </span>
      <div className="min-w-0 flex-1 text-sm text-soft-ink">
        <p>{step.text}</p>
        {step.image ? <GuideImage image={step.image} /> : null}
        {step.note ? <GuideCallout note={step.note} /> : null}
      </div>
    </li>
  );
}

function GuideToc() {
  return (
    <Card as="section" aria-label="Mục lục hướng dẫn">
      <CardHeader title="Mục lục" />
      <ul className="flex flex-wrap gap-2">
        {GUIDE_SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${sectionAnchor(section.id)}`}
              className="inline-flex rounded-full bg-soft-accent-soft px-3 py-1.5 text-[13px] font-bold text-soft-accent-ink hover:bg-soft-inset-2 focus-visible:outline-2 focus-visible:outline-soft-focus"
            >
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function GuidePanel() {
  return (
    <div className="grid max-w-4xl gap-4">
      <GuideToc />
      {GUIDE_SECTIONS.map((section) => (
        <Card
          key={section.id}
          as="section"
          id={sectionAnchor(section.id)}
          aria-labelledby={`h-guide-${section.id}`}
          className="scroll-mt-4"
        >
          <CardHeader titleId={`h-guide-${section.id}`} title={section.title} />
          <ol className="flex flex-col gap-5">
            {section.steps.map((step, index) => (
              <GuideStepItem key={step.text} step={step} index={index} />
            ))}
          </ol>
        </Card>
      ))}
    </div>
  );
}

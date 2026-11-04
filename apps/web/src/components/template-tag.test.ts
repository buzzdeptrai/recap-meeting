import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HIDDEN_TEMPLATE_IDS, MEETING_TEMPLATES } from "@recap/core";
import { describe, expect, it } from "vitest";
import { TemplateCards } from "./template-cards";
import { TEMPLATE_ICONS, templateIcon } from "./template-icons";
import { TemplateTag } from "./template-tag";

describe("template icons", () => {
  it("has an icon for every template id and falls back for unknown ids", () => {
    for (const t of MEETING_TEMPLATES) expect(TEMPLATE_ICONS[t.id]).toBeDefined();
    expect(templateIcon("zzz")).toBe(TEMPLATE_ICONS.general);
  });
});

describe("TemplateTag", () => {
  it("shows the label from the registry and keeps it for screen readers when collapsed", () => {
    const html = renderToStaticMarkup(
      createElement(TemplateTag, { templateId: "interview", collapse: true }),
    );
    expect(html).toContain("Phỏng vấn");
    expect(html).toContain("max-sm:sr-only");
    expect(html).toContain("<svg");
  });
});

describe("TemplateCards", () => {
  it("renders one radio per template with the selected one expanded", () => {
    const html = renderToStaticMarkup(
      createElement(TemplateCards, { value: "client", onChange: () => {} }),
    );
    const offered = MEETING_TEMPLATES.filter((t) => !HIDDEN_TEMPLATE_IDS.includes(t.id));
    expect(html.match(/role="radio"/g)).toHaveLength(offered.length);
    expect(html).not.toContain("Phỏng vấn");
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    const client = MEETING_TEMPLATES.find((t) => t.id === "client");
    expect(html).toContain(client?.focus[0] ?? "missing");
    expect(html).toContain(client?.bestFor ?? "missing");
    const project = MEETING_TEMPLATES.find((t) => t.id === "project");
    expect(html).toContain(project?.tagline ?? "missing");
    expect(html).not.toContain(project?.focus[0] ?? "missing");
  });
  it("keeps a hidden type visible when the meeting already has it", () => {
    const html = renderToStaticMarkup(
      createElement(TemplateCards, { value: "interview", onChange: () => {} }),
    );
    expect(html).toContain("Phỏng vấn");
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionGroup, Button, Card, CardHeader, PageHeader, actionGroupVariants } from "../src";

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("ActionGroup", () => {
  it("uses an 8px gap and centred alignment in every placement", () => {
    for (const placement of ["toolbar", "end", "start", "center"] as const) {
      const classes = actionGroupVariants({ placement }).split(" ");
      expect(classes).toContain("gap-2");
      expect(classes).toContain("items-center");
    }
  });

  it("right-aligns dialog footers and stacks them full width on phones with confirm last", () => {
    const end = actionGroupVariants({ placement: "end" });
    expect(end).toContain("justify-end");
    expect(end).toContain("max-[640px]:flex-col");
    expect(end).not.toContain("flex-col-reverse");
    expect(end).toContain("max-[640px]:[&>*]:w-full");
  });

  it("keeps form footers left-aligned and puts the primary last on phones", () => {
    const start = actionGroupVariants({ placement: "start" });
    expect(start).not.toContain("justify-end");
    expect(start).toContain("max-[640px]:flex-col-reverse");
  });

  it("lets callers add classes without losing the spacing", () => {
    const out = html(
      <ActionGroup placement="end" className="mt-6">
        <Button>A</Button>
      </ActionGroup>,
    );
    expect(out).toContain("mt-6");
    expect(out).toContain("gap-2");
  });

  it("PageHeader and CardHeader place actions in an 8px group", () => {
    const page = html(<PageHeader title="T" actions={<Button>Go</Button>} />);
    expect(page).toContain("gap-2");
    const card = html(
      <Card>
        <CardHeader title="T" action={<Button size="sm">Go</Button>} />
      </Card>,
    );
    expect(card).toContain("justify-end");
  });
});

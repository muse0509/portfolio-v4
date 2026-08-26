import { describe, expect, it } from "vitest";

import { siteContent } from "./site";

describe("siteContent", () => {
  it("keeps the agreed identity and hero copy", () => {
    expect(siteContent.identity.name).toBe("Yusuke Kikuta");
    expect(siteContent.identity.role).toBe("Full-Stack Engineer");
    expect(siteContent.hero.headlineLines.join("")).toBe(
      siteContent.hero.headline,
    );
  });

  it("keeps provisional work content explicit and replaceable", () => {
    expect(siteContent.axis.disclaimer).toContain("Devnet");
    expect(siteContent.selectedWorks.items).toHaveLength(2);
    expect(
      siteContent.selectedWorks.items.every((work) =>
        work.status.includes("Pending"),
      ),
    ).toBe(true);
    expect(siteContent.writing.items).toHaveLength(3);
  });
});

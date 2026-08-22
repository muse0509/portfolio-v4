import { describe, expect, it } from "vitest";

import { siteContent } from "./site";

describe("siteContent", () => {
  it("keeps the agreed foundation-page copy", () => {
    expect(siteContent.hero.eyebrow).toBe(
      "FULL-STACK ENGINEER / PORTFOLIO V4",
    );
    expect(siteContent.hero.headline).toBe("構想を、動くプロダクトまで。");
    expect(siteContent.hero.headlineLines.join("")).toBe(
      siteContent.hero.headline,
    );
    expect(siteContent.hero.status).toContain("UIコンセプト画像");
  });
});

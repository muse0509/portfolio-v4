import { expect, test } from "@playwright/test";

const sectionOrder = [
  "hero",
  "axis",
  "capabilities",
  "about",
  "contact",
];

const viewports = [
  { width: 1440, height: 1000 },
  { width: 1280, height: 900 },
  { width: 1024, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 375, height: 812 },
  { width: 320, height: 568 },
];

test("renders Axis media with scroll autoplay and verified content", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const missingResources: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() === 404) {
      missingResources.push(response.url());
    }
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "構想を、動くプロダクトまで。", level: 1 }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  expect(
    await page
      .locator("body")
      .evaluate((element) => getComputedStyle(element).fontFamily),
  ).toContain("Zen Kaku Gothic New");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex, nofollow/i,
  );
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("footer, .site-footer")).toHaveCount(0);
  await expect(page.locator(".site-header .site-brand")).toHaveCount(0);
  await expect(
    page.locator(".site-header").getByText("Yusuke Kikuta", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".hero__background-image")).toBeVisible();
  await expect(page.locator(".hero__background-image")).toHaveAttribute(
    "alt",
    "",
  );
  await expect(page.locator("main [data-section]")).toHaveCount(
    sectionOrder.length,
  );

  const renderedOrder = await page
    .locator("main [data-section]")
    .evaluateAll((sections) => sections.map((section) => section.dataset.section));
  expect(renderedOrder).toEqual(sectionOrder);

  await expect(page.getByText("SELECTED WORK / 01", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "構想から市場へ。", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Solana上で、誰でも複数資産をひとつのバスケットとして扱えるプロダクト。",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "要件定義、UI設計、フロントエンド、バックエンド、公開、ローンチ後のマーケティングまで一貫して推進。",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText("約1か月で", { exact: true })).toBeVisible();
  await expect(page.getByText("再構築", { exact: true })).toBeVisible();
  await expect(page.getByText("約400ユーザー", { exact: true })).toBeVisible();
  await expect(page.getByText("2,100件超の", { exact: true })).toBeVisible();
  await expect(page.getByText("ETF作成", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Devnet / 実資金取引なし", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("LAUNCH TEASER / 00:42", { exact: true })).toBeVisible();
  await expect(page.locator(".axis-teaser")).toHaveAttribute(
    "data-video-state",
    "available",
  );
  await expect(page.getByRole("img", { name: "Axis" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Axis" })).toHaveAttribute(
    "loading",
    "lazy",
  );
  const teaserVideo = page.getByLabel("Axis launch teaser", { exact: true });
  await expect(teaserVideo).toHaveAttribute("src", "/media/axis/axis-teaser.mp4");
  await expect(teaserVideo).toHaveAttribute(
    "poster",
    "/media/axis/axis-teaser-poster.webp",
  );
  await expect(teaserVideo).toHaveAttribute("preload", "metadata");
  await expect(teaserVideo).toHaveAttribute("playsinline", "");
  await expect(teaserVideo).not.toHaveAttribute("autoplay", "");
  await expect(teaserVideo).not.toHaveAttribute("loop", "");
  await expect(teaserVideo).not.toHaveAttribute("controls", "");
  await teaserVideo.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      teaserVideo.evaluate((video) => (video as HTMLVideoElement).paused),
    )
    .toBe(false);
  await expect(teaserVideo).toHaveAttribute("controls", "");
  expect(
    await teaserVideo.evaluate((video) => (video as HTMLVideoElement).muted),
  ).toBe(true);
  const teaserPlayButton = page.getByRole("button", {
    name: "Axis launch teaserを再生",
  });
  await expect(teaserPlayButton).toHaveCount(0);
  await expect
    .poll(() =>
      teaserVideo.evaluate((video) => (video as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(0);
  await page.locator('[data-section="hero"]').scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      teaserVideo.evaluate((video) => (video as HTMLVideoElement).paused),
    )
    .toBe(true);
  const worksLink = page.getByRole("link", { name: "すべての実績を見る" });
  await expect(worksLink).toHaveAttribute("href", "/works");
  await worksLink.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(worksLink).toBeFocused();
  expect(
    await worksLink.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).not.toBe("none");
  const axisAppLink = page.getByRole("link", {
    name: "Axisアプリを新しいタブで開く",
  });
  await expect(axisAppLink).toHaveAttribute("href", "https://dev.axs.pizza");
  await expect(axisAppLink).toHaveAttribute("target", "_blank");
  await expect(axisAppLink).toHaveAttribute("rel", /noopener noreferrer/);
  await axisAppLink.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(axisAppLink).toBeFocused();
  expect(
    await axisAppLink.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).not.toBe("none");
  const axisRepositoryLink = page.getByRole("link", {
    name: "AxisのGitHubリポジトリを新しいタブで開く",
  });
  await expect(axisRepositoryLink).toHaveAttribute(
    "href",
    "https://github.com/Axis-pizza/Axis_MVP",
  );
  await expect(axisRepositoryLink).toHaveAttribute("target", "_blank");
  await expect(axisRepositoryLink).toHaveAttribute(
    "rel",
    /noopener noreferrer/,
  );
  await expect(axisRepositoryLink.locator("svg")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  const repositoryLinkBox = await axisRepositoryLink.boundingBox();
  expect(repositoryLinkBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(repositoryLinkBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await axisRepositoryLink.focus();
  expect(
    await axisRepositoryLink.evaluate(
      (element) => getComputedStyle(element).outlineStyle,
    ),
  ).not.toBe("none");
  await expect(page.locator("#liquid-glass-distortion")).toHaveCount(1);
  await expect(page.locator(".liquid-glass")).toHaveCount(2);
  await expect(
    page.locator(
      ".proof-strip, .work-row, .writing-panel, .media-placeholder",
    ),
  ).toHaveCount(0);
  await expect(page.locator(".capabilities .arrow-mark")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    /FULL-STACK ENGINEER|Pending|Preparing|Selected Work|Project 0[23]|Writing 0/,
  );

  const glassRendering = await page
    .locator(".liquid-glass--hero")
    .evaluate((element) => ({
      backgroundColor: getComputedStyle(element).backgroundColor,
      backdropFilter: getComputedStyle(element).backdropFilter,
      contentFilter: getComputedStyle(
        element.querySelector(".liquid-glass__content")!,
      ).filter,
      contentIsInsideButton:
        element.querySelector(".liquid-glass__content")?.parentElement ===
        element,
    }));
  expect(glassRendering.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(glassRendering.backdropFilter).toContain("liquid-glass-distortion");
  expect(glassRendering.contentFilter).toBe("none");
  expect(glassRendering.contentIsInsideButton).toBe(true);
  await expect(
    page.getByRole("heading", { name: "対応できる領域", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByText("CAPABILITY INDEX / 2026.08", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "実務案件と継続中の自社プロダクトで使用した技術のみを掲載。",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "期間は2026年8月時点の概算。重複する案件期間は合算していません。",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator(".capability-core__item")).toHaveCount(6);
  await expect(page.locator(".capability-category")).toHaveCount(3);
  await expect(page.locator(".capability-tech")).toHaveCount(12);
  await expect(page.locator(".capability-core .tech-icon")).toHaveCount(6);
  await expect(page.locator(".capability-extended .tech-icon")).toHaveCount(11);
  await expect(
    page.locator(".capability-core__item").filter({ hasText: "OpenAI API" }).locator("svg"),
  ).toHaveCount(1);
  await expect(
    page.locator(".capability-tech").filter({ hasText: "AWS" }).locator("svg"),
  ).toHaveCount(0);
  await expect(page.locator(".capabilities")).not.toContainText(
    /ONCHAIN|REST API|RAG|Wallet Adapter|Jupiter|SPL Token/,
  );
  expect(
    await page
      .locator(".capabilities .tech-icon")
      .evaluateAll((icons) =>
        icons.every((icon) => icon.getAttribute("aria-hidden") === "true"),
      ),
  ).toBe(true);
  await expect(page.locator(".capabilities .liquid-glass")).toHaveCount(0);
  await expect(page.getByLabel("対応可能な工程")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "開発の進め方" }),
  ).toHaveCount(0);
  await expect(page.locator(".site-header")).not.toContainText("進め方");
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(missingResources).toEqual([]);
});

for (const viewport of viewports) {
  test(`has stable layout at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

    const headingBox = await page.locator("h1").boundingBox();
    expect(headingBox).not.toBeNull();
    expect(headingBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((headingBox?.x ?? 0) + (headingBox?.width ?? 0)).toBeLessThanOrEqual(
      viewport.width,
    );

    const nextSectionBox = await page
      .locator('[data-section="axis"]')
      .boundingBox();
    if (viewport.width >= 1024) {
      expect(nextSectionBox?.y ?? 0).toBeGreaterThanOrEqual(
        viewport.height - 1,
      );
      expect(nextSectionBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
        viewport.height + 1,
      );
    } else {
      expect(nextSectionBox?.y ?? viewport.height).toBeLessThan(viewport.height);
    }

    const teaserBox = await page.locator(".axis-teaser").boundingBox();
    expect(teaserBox?.width ?? 0).toBeGreaterThan(0);
    expect((teaserBox?.x ?? -1) + (teaserBox?.width ?? 0)).toBeLessThanOrEqual(
      viewport.width,
    );
    expect((teaserBox?.width ?? 0) / (teaserBox?.height ?? 1)).toBeCloseTo(
      16 / 9,
      1,
    );

    if (viewport.width < 1024) {
      const factColumns = await page
        .locator(".axis-featured__facts")
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns);
      const maximumColumns = viewport.width >= 640 ? 3 : 1;
      expect(factColumns.split(" ").length).toBeLessThanOrEqual(maximumColumns);
    }

    const coreColumnCount = await page
      .locator(".capability-core__grid")
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
      );
    const extendedColumnCount = await page
      .locator(".capability-extended__categories")
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
      );
    expect(coreColumnCount).toBe(
      viewport.width >= 1200 ? 6 : viewport.width >= 640 ? 3 : 2,
    );
    expect(extendedColumnCount).toBe(
      viewport.width >= 1024 ? 3 : viewport.width >= 640 ? 2 : 1,
    );

    for (const duration of await page
      .locator(".capability-core__duration, .capability-tech__duration")
      .all()) {
      const box = await duration.boundingBox();
      expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        viewport.width,
      );
    }

    if (viewport.width === 390) {
      for (const technologyName of await page
        .locator(".capability-core__name, .capability-tech__name")
        .all()) {
        const renderedLines = await technologyName.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return new Set(
            Array.from(range.getClientRects()).map((rect) => Math.round(rect.top)),
          ).size;
        });
        expect(renderedLines).toBe(1);
      }
    }

    await page.screenshot({
      fullPage: true,
      path: `test-results/design/home-${viewport.width}x${viewport.height}.png`,
    });

    if (viewport.width === 1440 || viewport.width === 390) {
      const capabilitySection = page.locator(".capabilities");
      await capabilitySection.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          capabilitySection
            .locator("[data-reveal]")
            .evaluate((element) => getComputedStyle(element).opacity),
        )
        .toBe("1");
      await page.locator(".site-header").evaluate((header) => {
        header.setAttribute("hidden", "");
      });
      await capabilitySection.screenshot({
        path: `test-results/design/capabilities-${viewport.width}x${viewport.height}.png`,
      });
    }
  });
}

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`keeps the header visible while scrolling at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const header = page.locator(".site-header");
    await expect(header).toBeVisible();
    expect(
      await header.evaluate((element) => getComputedStyle(element).position),
    ).toBe("sticky");

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, document.documentElement.scrollHeight / 2);
    });
    await expect
      .poll(() =>
        header.evaluate((element) =>
          Math.round(element.getBoundingClientRect().top),
        ),
      )
      .toBe(0);

    await page.evaluate(() => {
      document.querySelector<HTMLElement>("#about")?.scrollIntoView({
        block: "start",
      });
    });
    const anchorGeometry = await page.evaluate(() => {
      const headerElement = document.querySelector<HTMLElement>(".site-header");
      const targetElement = document.querySelector<HTMLElement>("#about");

      return {
        headerHeight: headerElement?.getBoundingClientRect().height ?? 0,
        scrollPaddingTop: Number.parseFloat(
          getComputedStyle(document.documentElement).scrollPaddingTop,
        ),
        targetTop: targetElement?.getBoundingClientRect().top ?? 0,
      };
    });
    expect(anchorGeometry.scrollPaddingTop).toBeGreaterThan(
      anchorGeometry.headerHeight,
    );
    expect(anchorGeometry.targetTop).toBeGreaterThanOrEqual(
      anchorGeometry.headerHeight,
    );
  });
}

test("mobile menu closes with Escape and link selection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const menuButton = page.locator(".menu-button");
  await expect(menuButton).toHaveAccessibleName("メニューを開く");
  await menuButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(menuButton).toHaveAccessibleName("メニューを閉じる");
  await expect(page.locator("#mobile-navigation")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menuButton).toHaveAccessibleName("メニューを開く");
  await expect(menuButton).toBeFocused();

  await menuButton.click();
  await page.locator("#mobile-navigation").getByRole("link", { name: "Axis" }).click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/#axis$/);
});

test("renders the complete works page without per-project detail links", async ({
  page,
}) => {
  const missingResources: string[] = [];
  page.on("response", (response) => {
    if (response.status() === 404) {
      missingResources.push(response.url());
    }
  });

  await page.goto("/works");

  await expect(page.getByRole("heading", { name: "実績", level: 1 })).toBeVisible();
  await expect(page.locator(".works-entry")).toHaveCount(1);
  await expect(page.locator(".works-page article")).toHaveCount(5);
  await expect(
    page.getByRole("heading", {
      name: "Axis — オンチェーン・バスケット型DeFiプロダクト",
      level: 2,
    }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "Axis" })).toHaveAttribute(
    "loading",
    "eager",
  );
  for (const title of [
    "AI営業オートメーション",
    "Solana DeFi Vault Interface",
    "生成AI・RAG業務支援アプリ",
    "スタートアップMVP開発支援",
  ]) {
    await expect(page.getByRole("heading", { name: title, level: 3 })).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: "受賞・登壇", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("Breakout Hackathon", { exact: true })).toBeVisible();
  await expect(
    page.getByText("mtnDAO Demo Day / Salt Lake City", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/Project 0[23]|準備中|Pending/);
  await expect(page.locator(".works-projects a")).toHaveCount(0);
  expect(
    await page
      .locator(".works-axis, .works-projects")
      .evaluateAll((sections) =>
        sections.some((section) => /[→↗↘]/.test(section.textContent ?? "")),
      ),
  ).toBe(false);
  await expect(
    page.getByRole("link", { name: "Axisアプリを新しいタブで開く" }),
  ).toHaveAttribute("href", "https://dev.axs.pizza");
  await expect(
    page.getByRole("link", {
      name: "AxisのGitHubリポジトリを新しいタブで開く",
    }),
  ).toHaveAttribute("href", "https://github.com/Axis-pizza/Axis_MVP");
  await expect(page.getByRole("link", { name: /トップへ戻る/ })).toHaveAttribute(
    "href",
    "/",
  );
  expect(missingResources).toEqual([]);
});

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
]) {
  test(`keeps the works page stable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/works");
    await page.evaluate(() => document.fonts.ready);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

    for (const article of await page.locator(".works-page article").all()) {
      const box = await article.boundingBox();
      expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        viewport.width,
      );
    }

    if (viewport.width === 375) {
      for (const element of await page
        .locator(
          ".works-introduction__heading-scope, .works-speaking__event-name, .works-speaking__location, .works-project__outcome > p:last-child span",
        )
        .all()) {
        const renderedLines = await element.evaluate((node) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          return new Set(
            Array.from(range.getClientRects()).map((rect) => Math.round(rect.top)),
          ).size;
        });
        expect(renderedLines).toBe(1);
      }
    }

    await page.screenshot({
      fullPage: true,
      path: `test-results/design/works-${viewport.width}.png`,
    });
  });
}

test("reduced motion disables long-running movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const teaserVideo = page.getByLabel("Axis launch teaser", { exact: true });
  const teaserPlayButton = page.getByRole("button", {
    name: "Axis launch teaserを再生",
  });
  await teaserVideo.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  expect(
    await teaserVideo.evaluate((video) => (video as HTMLVideoElement).paused),
  ).toBe(true);
  await expect(teaserPlayButton).toBeVisible();
  await teaserPlayButton.click();
  await expect
    .poll(() =>
      teaserVideo.evaluate((video) => (video as HTMLVideoElement).paused),
    )
    .toBe(false);
  expect(
    await teaserVideo.evaluate((video) => (video as HTMLVideoElement).muted),
  ).toBe(false);
  await teaserVideo.evaluate((video) => (video as HTMLVideoElement).pause());

  await page.locator(".liquid-glass--hero").hover();
  const arrowTransform = await page
    .locator(".liquid-glass--hero .arrow-mark")
    .evaluate((element) => getComputedStyle(element).transform);
  expect(arrowTransform).toBe("none");

  const longRunningAnimations = await page.evaluate(
    () =>
      document.getAnimations().filter((animation) => {
        const timing = animation.effect?.getComputedTiming();
        return animation.playState === "running" && Number(timing?.duration ?? 0) > 1;
      }).length,
  );
  expect(longRunningAnimations).toBe(0);
});

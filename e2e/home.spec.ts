import { expect, test } from "@playwright/test";

const sectionOrder = [
  "hero",
  "proof",
  "axis",
  "evidence",
  "timeline",
  "works",
  "capabilities",
  "process",
  "about-writing",
  "contact",
];

const viewports = [
  { width: 1440, height: 1000 },
  { width: 1280, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 375, height: 812 },
  { width: 320, height: 568 },
];

test("renders the complete Japanese Product Cinema homepage", async ({ page }) => {
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
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex, nofollow/i,
  );
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("main > section")).toHaveCount(sectionOrder.length);

  const renderedOrder = await page
    .locator("main > section")
    .evaluateAll((sections) => sections.map((section) => section.dataset.section));
  expect(renderedOrder).toEqual(sectionOrder);

  await expect(page.getByText("Devnet / 実資金取引なし")).toBeVisible();
  await expect(page.locator(".media-placeholder--axis")).toBeVisible();
  await expect(page.locator(".media-placeholder--project")).toHaveCount(2);
  await expect(page.locator(".media-placeholder--portrait")).toHaveCount(1);
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
      .locator(viewport.width >= 1024 ? '[data-section="axis"]' : '[data-section="proof"]')
      .boundingBox();
    expect(nextSectionBox?.y ?? viewport.height).toBeLessThan(viewport.height);

    const mediaExpectations = [
      {
        selector: ".media-placeholder--axis",
        ratio: viewport.width >= 1024 ? 16 / 9 : 16 / 10,
      },
      { selector: ".media-placeholder--project", ratio: 16 / 5 },
      {
        selector: ".media-placeholder--portrait",
        ratio: viewport.width >= 1024 ? 1 : 16 / 5,
      },
    ];

    for (const expectation of mediaExpectations) {
      const boxes = await page.locator(expectation.selector).all();
      for (const locator of boxes) {
        const box = await locator.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThan(0);
        expect(box?.height ?? 0).toBeGreaterThan(0);
        expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(
          expectation.ratio,
          1,
        );
      }
    }

    if (viewport.width < 1024) {
      const aboutBox = await page.locator(".about-panel").boundingBox();
      const writingBox = await page.locator(".writing-panel").boundingBox();
      expect(writingBox?.y ?? 0).toBeGreaterThan(
        (aboutBox?.y ?? 0) + (aboutBox?.height ?? 0) - 1,
      );

      const timelineColumns = await page
        .locator(".responsibility__list")
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns);
      expect(timelineColumns.split(" ")).toHaveLength(1);
    } else {
      const firstCopy = await page.locator(".work-row").first().locator(".work-row__copy").boundingBox();
      const firstMedia = await page.locator(".work-row").first().locator(".work-row__media").boundingBox();
      const secondCopy = await page.locator(".work-row").nth(1).locator(".work-row__copy").boundingBox();
      const secondMedia = await page.locator(".work-row").nth(1).locator(".work-row__media").boundingBox();
      expect(firstCopy?.x ?? 0).toBeLessThan(firstMedia?.x ?? 0);
      expect(secondCopy?.x ?? 0).toBeGreaterThan(secondMedia?.x ?? 0);
    }

    await page.screenshot({
      fullPage: true,
      path: `test-results/design/home-${viewport.width}x${viewport.height}.png`,
    });
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
  await page.locator("#mobile-navigation").getByRole("link", { name: "実績" }).click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/#works$/);
});

test("reduced motion disables long-running movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await page.locator(".axis-stage").hover();
  const axisTransform = await page
    .locator(".media-placeholder--axis")
    .evaluate((element) => getComputedStyle(element).transform);
  expect(axisTransform).toBe("none");

  const longRunningAnimations = await page.evaluate(
    () =>
      document.getAnimations().filter((animation) => {
        const timing = animation.effect?.getComputedTiming();
        return animation.playState === "running" && Number(timing?.duration ?? 0) > 1;
      }).length,
  );
  expect(longRunningAnimations).toBe(0);
});

import { expect, test } from "@playwright/test";

test("renders the Japanese foundation page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "構想を、動くプロダクトまで。" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
});

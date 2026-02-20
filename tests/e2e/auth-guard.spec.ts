import { expect, test } from "@playwright/test";

test("dashboard route loads without runtime application error", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.getByText(/application error/i)).toHaveCount(0);
});

test("login route loads without runtime application error", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.getByText(/application error/i)).toHaveCount(0);
});

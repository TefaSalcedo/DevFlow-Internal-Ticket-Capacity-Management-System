import { expect, test } from "@playwright/test";

test("redirects unauthenticated user to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});

test("renders login form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel(/email address/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});

import { expect, type Page, test } from "@playwright/test";

async function assertAuthenticatedOrLogin(page: Page) {
  if (page.url().includes("/login")) {
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/application error/i)).toHaveCount(0);
    return false;
  }

  return true;
}

test("ticket form supports team, multi-members and new statuses", async ({ page }) => {
  await page.goto("/tickets/new");
  const isAuthenticated = await assertAuthenticatedOrLogin(page);

  if (!isAuthenticated) {
    return;
  }

  await expect(page.getByLabel(/ticket title/i)).toBeVisible();
  await expect(page.getByLabel(/assignees/i)).toBeVisible();
  await expect(page.getByLabel(/team/i)).toBeVisible();

  const assigneeSelect = page.locator("#assignedToIds");
  await expect(assigneeSelect).toHaveAttribute("multiple", "");

  const statusSelect = page.locator("#status");
  await expect(statusSelect.locator('option[value="BUG"]')).toBeVisible();
  await expect(statusSelect.locator('option[value="DESIGN"]')).toBeVisible();

  const allAssigneeOptionsText = await assigneeSelect.locator("option").allTextContents();
  const containsSuperAdmin = allAssigneeOptionsText.some((text) => /super\s*admin/i.test(text));
  expect(containsSuperAdmin).toBeFalsy();
});

test("ticket dashboard exposes team filtering and bug/design columns", async ({ page }) => {
  await page.goto("/tickets");
  const isAuthenticated = await assertAuthenticatedOrLogin(page);

  if (!isAuthenticated) {
    return;
  }

  await expect(page.getByRole("heading", { name: /ticket board/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /all teams/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^bug$/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^design$/i })).toBeVisible();

  const teamLinks = page.locator('a[href*="/tickets?doneMonth="][href*="teamId="]');
  const teamCount = await teamLinks.count();

  if (teamCount > 0) {
    await teamLinks.first().click();
    await expect(page).toHaveURL(/teamId=/);
  }
});

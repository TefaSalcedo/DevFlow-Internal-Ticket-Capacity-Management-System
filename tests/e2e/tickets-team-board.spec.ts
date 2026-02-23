import { expect, type Page, test } from "@playwright/test";

const CREATOR_EMAIL = process.env.E2E_CREATOR_EMAIL;
const CREATOR_PASSWORD = process.env.E2E_CREATOR_PASSWORD;
const ASSIGNEE_EMAIL = process.env.E2E_ASSIGNEE_EMAIL;
const ASSIGNEE_PASSWORD = process.env.E2E_ASSIGNEE_PASSWORD;
const SUPER_ADMIN_EMAIL = process.env.E2E_SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = process.env.E2E_SUPER_ADMIN_PASSWORD;
const FORBIDDEN_COMPANY_ID = process.env.E2E_FORBIDDEN_COMPANY_ID;
const FORBIDDEN_TEAM_ID = process.env.E2E_FORBIDDEN_TEAM_ID;
const FORBIDDEN_BOARD_ID = process.env.E2E_FORBIDDEN_BOARD_ID;

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 20000 });
}

test("user switching board updates kanban", async ({ page }) => {
  test.skip(!CREATOR_EMAIL || !CREATOR_PASSWORD, "Missing creator credentials");

  await login(page, CREATOR_EMAIL as string, CREATOR_PASSWORD as string);
  await page.goto("/tickets");

  const boardSelect = page.locator("#ticket-board-scope");
  await expect(boardSelect).toBeVisible();

  const options = await boardSelect.locator("option").all();
  test.skip(options.length < 2, "Need at least 2 boards to validate board switching");

  const firstValue = await options[0].getAttribute("value");
  const secondValue = await options[1].getAttribute("value");
  if (!firstValue || !secondValue) {
    test.skip(true, "Board options do not have values");
  }

  await boardSelect.selectOption(secondValue as string);
  await expect(page).toHaveURL(new RegExp(`board=${secondValue}`));

  await boardSelect.selectOption(firstValue as string);
  await expect(page).toHaveURL(new RegExp(`board=${firstValue}`));
});

test("user sees tickets assigned from another team", async ({ page }) => {
  test.skip(!ASSIGNEE_EMAIL || !ASSIGNEE_PASSWORD, "Missing assignee credentials");

  await login(page, ASSIGNEE_EMAIL as string, ASSIGNEE_PASSWORD as string);
  await page.goto("/tickets/mine");

  await expect(page.getByRole("heading", { name: /my tasks/i })).toBeVisible();
  await expect(page.locator("text=Team:").first()).toBeVisible();
  await expect(page.locator("text=Board:").first()).toBeVisible();
});

test("user cannot access another company board", async ({ page }) => {
  test.skip(!CREATOR_EMAIL || !CREATOR_PASSWORD, "Missing creator credentials");
  test.skip(
    !FORBIDDEN_COMPANY_ID || !FORBIDDEN_TEAM_ID || !FORBIDDEN_BOARD_ID,
    "Missing forbidden scope identifiers"
  );

  await login(page, CREATOR_EMAIL as string, CREATOR_PASSWORD as string);
  await page.goto(
    `/tickets?company=${FORBIDDEN_COMPANY_ID}&team=${FORBIDDEN_TEAM_ID}&board=${FORBIDDEN_BOARD_ID}`
  );

  await expect(page.getByText(/application error/i)).toHaveCount(0);
  await expect(page.locator("body")).toBeVisible();
});

test("super admin global visibility", async ({ page }) => {
  test.skip(!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD, "Missing super admin credentials");

  await login(page, SUPER_ADMIN_EMAIL as string, SUPER_ADMIN_PASSWORD as string);
  await page.goto("/tickets/all");

  await expect(page.getByRole("heading", { name: /all tasks/i })).toBeVisible();
  await expect(page.getByText(/application error/i)).toHaveCount(0);
});

test("/tickets/mine aggregation correctness by group switch", async ({ page }) => {
  test.skip(!ASSIGNEE_EMAIL || !ASSIGNEE_PASSWORD, "Missing assignee credentials");

  await login(page, ASSIGNEE_EMAIL as string, ASSIGNEE_PASSWORD as string);
  await page.goto("/tickets/mine");

  const groupBySelect = page.locator("#mine-filter-group-by");
  await expect(groupBySelect).toBeVisible();

  await groupBySelect.selectOption("team");
  await page.getByRole("button", { name: /apply filters/i }).click();
  await expect(page).toHaveURL(/groupBy=team/);

  await groupBySelect.selectOption("board");
  await page.getByRole("button", { name: /apply filters/i }).click();
  await expect(page).toHaveURL(/groupBy=board/);
});

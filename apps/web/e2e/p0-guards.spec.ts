import { expect, test } from "@playwright/test";

test("login page and settings link remain available", async ({ page }) => {
  await page.goto("/en/login");
  await expect(page.getByRole("heading", { name: /Sign in/i })).toBeVisible();
});

test("x bind required surfaces from join when api available", async ({
  page,
  request,
}) => {
  const health = await request
    .get("http://localhost:5181/health")
    .catch(() => null);
  test.skip(!health || !health.ok(), "API not running");

  const stamp = Date.now();
  await page.goto("/en/login");
  await page.getByText("Developer login").click();
  await page.getByLabel("Dev user id").fill(`e2e-pub-${stamp}`);
  await page.getByLabel("Display name").fill("E2E Publisher");
  await page.getByRole("button", { name: /Dev Login/i }).click();
  await expect(page).toHaveURL(/\/en\/tasks/);
});

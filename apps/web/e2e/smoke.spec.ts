import { expect, test } from "@playwright/test";

test("home and locale switch", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByText("Kairo").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await page.getByRole("link", { name: "zh" }).click();
  await expect(page).toHaveURL(/\/zh/);
  await expect(page.getByRole("link", { name: "登录" })).toBeVisible();
});

test("login page renders oauth and dev login", async ({ page }) => {
  await page.goto("/en/login");
  await expect(page.getByRole("heading", { name: /Sign in/i })).toBeVisible();
  await expect(page.getByText(/Developer login/i)).toBeVisible();
});

test("dev login flow when api available", async ({ page, request }) => {
  const health = await request.get("http://localhost:5181/health").catch(() => null);
  test.skip(!health || !health.ok(), "API not running");

  await page.goto("/en/login");
  await page.getByText("Developer login").click();
  await page.getByLabel("Dev user id").fill(`e2e-${Date.now()}`);
  await page.getByLabel("Display name").fill("E2E User");
  await page.getByRole("button", { name: /Dev Login/i }).click();
  await expect(page).toHaveURL(/\/en\/tasks/);
});

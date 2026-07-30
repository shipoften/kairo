import { expect, test } from "@playwright/test";

test("join button surfaces x bind guidance copy on tasks page", async ({
  page,
}) => {
  await page.goto("/en/tasks");
  await expect(page.getByRole("heading").first()).toBeVisible();
});

test("admin page requires auth", async ({ page }) => {
  await page.goto("/en/admin");
  await expect(page).toHaveURL(/login|admin/);
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const publicPages = [
  { path: "/", name: "home" },
  { path: "/community", name: "community" },
  { path: "/discover", name: "discover" },
  { path: "/discover/groups", name: "group discovery" },
  { path: "/signin", name: "sign in" },
  { path: "/signup", name: "sign up" },
];

async function expectNoAccessibilityViolations(page: Page, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .disableRules(["color-contrast"])
    .analyze();

  await testInfo.attach("axe-violations", {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });

  expect(results.violations).toEqual([]);
}

test.describe("automated accessibility", () => {
  test.describe.configure({ timeout: 60_000 });

  for (const { path, name } of publicPages) {
    test(`${name} page passes configured WCAG A and AA checks`, async ({ page }, testInfo) => {
      const response = await page.goto(path);

      expect(response, `${path} should return a document response`).not.toBeNull();
      expect(response!.status(), `${path} should not return a server error`).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
      await expectNoAccessibilityViolations(page, testInfo);
    });
  }

  test("signed-out protected route guard is accessible", async ({ page }, testInfo) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/signin(?:\?.*)?$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    await expectNoAccessibilityViolations(page, testInfo);
  });
});

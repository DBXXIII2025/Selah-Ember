import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const publicPages = [
  { path: "/", name: "home" },
  { path: "/community", name: "community" },
  { path: "/discover", name: "discover" },
  { path: "/discover/groups", name: "group discovery" },
  { path: "/signin", name: "sign in" },
  { path: "/signup", name: "sign up" },
  { path: "/delete-account", name: "account deletion" },
];

async function expectNoAccessibilityViolations(page: Page, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
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

  test("mobile navigation restores focus when dismissed", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/discover");

    const trigger = page.getByRole("button", { name: "Open navigation menu" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("navigation", { name: "Mobile primary navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Discover", exact: true })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Mobile primary navigation" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeFocused();
  });

  test("skip link and auth controls follow a logical keyboard order", async ({ page }) => {
    await page.goto("/signin");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();

    const email = page.getByRole("textbox", { name: "Email" });
    await email.focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeFocused();
  });
});

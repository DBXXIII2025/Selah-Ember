import { expect, test, type Page } from "@playwright/test";

async function expectPageLoads(page: Page, path: string, heading: string) {
  const response = await page.goto(path);

  expect(response, `${path} should return a document response`).not.toBeNull();
  expect(response!.status(), `${path} should not return a server error`).toBeLessThan(500);
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "We could not load this space" })).toHaveCount(0);
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
}

test.describe("public pages", () => {
  test.describe.configure({ timeout: 60_000 });

  test("home and discovery pages load", async ({ page }) => {
    await expectPageLoads(page, "/", "An open faith community for prayer, groups, and fellowship");
    await expectPageLoads(page, "/discover", "Find a fellowship community");
    await expectPageLoads(page, "/discover/groups", "Find a Bible study group");
  });

  test("open community feed loads", async ({ page }) => {
    await expectPageLoads(page, "/community", "Selah Ember Community");
  });

  test("authentication pages load", async ({ page }) => {
    await expectPageLoads(page, "/signin", "Sign in");
    await expectPageLoads(page, "/signup", "Create your account");
  });
});

test("protected pages send signed-out visitors to sign in", async ({ page }) => {
  for (const path of ["/dashboard", "/messages", "/notifications", "/profile", "/platform"]) {
    await page.goto(path);
    await expect(page, `${path} should be guarded`).toHaveURL(/\/signin(?:\?.*)?$/);
  }
});

test("signed-out navigation does not expose platform access", async ({ page }) => {
  await page.goto("/community");

  await expect(page.getByRole("heading", { level: 1, name: "Selah Ember Community" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "We could not load this space" })).toHaveCount(0);
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(navigation.getByRole("link", { name: "Discover", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Platform", exact: true })).toHaveCount(0);
});

test("robots and sitemap endpoints respond", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBeTruthy();
  await expect(robots.text()).resolves.toContain("User-Agent: *");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  await expect(sitemap.text()).resolves.toContain("<urlset");
});

test("unknown routes render the branded not-found state", async ({ page }) => {
  const response = await page.goto("/phase-17-smoke-missing");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "This fellowship path is quiet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return home" })).toBeVisible();
});

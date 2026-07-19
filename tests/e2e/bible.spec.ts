import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index > 0) {
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();
      if (key && !process.env[key]) process.env[key] = value;
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.skip(!url || !anonKey || !serviceKey, "Supabase environment variables are required for Bible fixtures.");

const admin = createClient(url || "", serviceKey || "", {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = `bible-${Date.now()}`;
const password = `BibleFeature!${Date.now()}`;
const authCookieName = url ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : "";
const testBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3100}`;
const testBaseHost = new URL(testBaseUrl).hostname;
const isSecureTestBase = new URL(testBaseUrl).protocol === "https:";
let userId = "";
let email = "";

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function chunkCookieValue(key: string, value: string) {
  const maxChunkSize = 3180;
  const encodedLength = encodeURIComponent(value).length;
  if (encodedLength <= maxChunkSize) return [{ name: key, value }];
  const chunks: string[] = [];
  let encodedValue = encodeURIComponent(value);
  while (encodedValue.length > 0) {
    const encodedChunk = encodedValue.slice(0, maxChunkSize);
    chunks.push(decodeURIComponent(encodedChunk));
    encodedValue = encodedValue.slice(encodedChunk.length);
  }
  return chunks.map((value, index) => ({ name: `${key}.${index}`, value }));
}

async function signIn(page: Page) {
  if (!url || !anonKey || !authCookieName) throw new Error("Supabase auth configuration is missing.");
  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
  if (!data.session) throw new Error("Fixture auth session was not created.");
  await page.context().clearCookies();
  const cookiePayload = `base64-${encodeBase64Url(JSON.stringify(data.session))}`;
  const cookies = chunkCookieValue(authCookieName, cookiePayload).map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: testBaseHost,
    path: "/",
    sameSite: "Lax" as const,
    httpOnly: false,
    secure: isSecureTestBase,
  }));
  await page.context().addCookies(cookies);
}

async function expectNoAccessibilityViolations(page: Page, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  await testInfo.attach("axe-violations", {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });
  expect(results.violations).toEqual([]);
}

test.describe.serial("Bible reader", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async () => {
    email = `${runId}@example.invalid`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: runId },
    });
    expect(error).toBeNull();
    if (!data.user) throw new Error("Fixture auth user was not created.");
    userId = data.user.id;
    const { error: profileError } = await admin.from("profiles").insert({
      user_id: userId,
      display_name: runId,
      username: runId,
    });
    expect(profileError).toBeNull();
  });

  test.afterAll(async () => {
    if (!userId) return;
    for (const table of ["bible_verse_notes", "bible_highlights", "bible_favorites", "bible_bookmarks", "bible_reading_history"]) {
      await admin.from(table).delete().eq("user_id", userId);
    }
    await admin.from("profiles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  });

  test("loads translations, navigation, search, and private verse state", async ({ page }, testInfo) => {
    await signIn(page);
    await page.goto("/bible?translation=web&book=JHN&chapter=3", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("link", { name: "Bible", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Bible" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "John 3" })).toBeVisible();
    await expect(page.getByLabel("Translation")).toContainText("WEB - World English Bible");
    await expect(page.getByLabel("Translation")).toContainText("BSB - Berean Standard Bible");

    await page.getByLabel("Search or reference").fill("John 3:16");
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect(page).toHaveURL(/\/bible\?.*q=John\+3%3A16/, { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole("link", { name: "John 3:16" })).toBeVisible();

    await page.getByRole("button", { name: /^Bookmark/ }).first().click();
    await expect(page.getByRole("button", { name: /Bookmarked/ }).first()).toBeVisible({ timeout: 90_000 });
    await page.getByRole("button", { name: /^Favorite/ }).first().click();
    await expect(page.getByRole("button", { name: /Favorited/ }).first()).toBeVisible({ timeout: 90_000 });
    await page.getByRole("button", { name: /^Highlight/ }).first().click();
    await expect(page.getByRole("button", { name: /Highlighted/ }).first()).toBeVisible({ timeout: 90_000 });

    await page.getByText("Private note").first().click();
    await page.getByLabel("Note for this verse").first().fill("Private Bible note");
    await page.getByRole("button", { name: "Save note" }).first().click();
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 90_000 });

    await page.setViewportSize({ width: 360, height: 820 });
    await expect(page.locator("body")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    await expectNoAccessibilityViolations(page, testInfo);
  });
});

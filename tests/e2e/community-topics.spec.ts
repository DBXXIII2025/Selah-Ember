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

test.skip(!url || !anonKey || !serviceKey, "Supabase environment variables are required for Community topic fixtures.");

const admin = createClient(url || "", serviceKey || "", {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = `community-topics-${Date.now()}`;
const password = `CommunityTopics!${Date.now()}`;
const authCookieName = url ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : "";
const testBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3100}`;
const testBaseHost = new URL(testBaseUrl).hostname;
const isSecureTestBase = new URL(testBaseUrl).protocol === "https:";

type FixtureUser = { email: string; userId: string; profileId: string };
const users: FixtureUser[] = [];
let member: FixtureUser;
let reporter: FixtureUser;
let platform: FixtureUser;
let banned: FixtureUser;
let angerTopicId = "";
let testimonyId = "";
let postId = "";

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

async function hasCommunityTopicSchema() {
  const { error } = await admin.from("community_topics").select("id").limit(1);
  return !error;
}

async function createUser(key: string, role = "user") {
  const email = `${runId}-${key}@example.invalid`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `${runId} ${key}` },
  });
  expect(userError).toBeNull();
  if (!userData.user) throw new Error("Fixture auth user was not created.");
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .insert({
      user_id: userData.user.id,
      display_name: `${runId} ${key}`,
      username: `${runId}-${key}`.replace(/[^a-z0-9-]/gi, ""),
      role,
    })
    .select("id,user_id")
    .single();
  expect(profileError).toBeNull();
  if (!profile) throw new Error("Fixture profile was not created.");
  const user = { email, userId: userData.user.id, profileId: profile.id };
  users.push(user);
  return user;
}

async function signIn(page: Page, user: FixtureUser) {
  if (!url || !anonKey || !authCookieName) throw new Error("Supabase auth configuration is missing.");
  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await authClient.auth.signInWithPassword({ email: user.email, password });
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

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
}

test.describe.serial("Community topics and testimonies", () => {
  test.describe.configure({ timeout: 300_000 });

  test.beforeAll(async () => {
    test.skip(!(await hasCommunityTopicSchema()), "Community topic migration has not been applied to the test database.");
    const { data: anger } = await admin.from("community_topics").select("id").eq("slug", "anger").single();
    angerTopicId = anger!.id;
    member = await createUser("member");
    reporter = await createUser("reporter");
    platform = await createUser("platform", "platform_engineer");
    banned = await createUser("banned");
    await admin.from("user_bans").insert({
      banned_user_id: banned.userId,
      banned_by: platform.profileId,
      reason: `${runId} banned fixture`,
      starts_at: new Date(Date.now() - 1000).toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  });

  test.afterAll(async () => {
    if (!(await hasCommunityTopicSchema())) return;
    if (testimonyId) {
      await admin.from("community_testimony_reports").delete().eq("testimony_id", testimonyId);
      await admin.from("community_testimony_encouragements").delete().eq("testimony_id", testimonyId);
      await admin.from("community_testimonies").delete().eq("id", testimonyId);
    }
    if (postId) {
      await admin.from("community_post_topics").delete().eq("post_id", postId);
      await admin.from("community_posts").delete().eq("id", postId);
    }
    for (const user of users) {
      await admin.from("user_bans").delete().eq("banned_user_id", user.userId);
      await admin.from("profiles").delete().eq("user_id", user.userId);
      await admin.auth.admin.deleteUser(user.userId);
    }
  });

  test("Community Home, topic list, sensitive topics, mobile widths, and axe checks", async ({ page }, testInfo) => {
    await page.goto("/community");
    await expect(page.getByRole("heading", { level: 1, name: "Selah Ember Community" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");

    await page.goto("/community/topics");
    await expect(page.getByRole("heading", { level: 1, name: "Topics" })).toBeVisible();
    for (const name of ["Anger", "PTSD", "Postpartum Depression (PPD)"]) {
      await expect(page.getByRole("link", { name: new RegExp(name.replace(/[()]/g, "\\$&")) })).toBeVisible();
    }

    await page.goto("/community/topics/ptsd");
    await expect(page.getByRole("heading", { level: 1, name: "PTSD" })).toBeVisible();
    await expect(page.getByText("not a substitute for professional medical care")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Scripture" })).toBeVisible();

    await page.goto("/community/topics/postpartum-depression-ppd");
    await expect(page.getByRole("heading", { level: 1, name: "Postpartum Depression (PPD)" })).toBeVisible();
    await expect(page.getByText("not a substitute for professional medical care")).toBeVisible();

    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/community/topics");
      await expectNoHorizontalOverflow(page);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/community/topics/anger");
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test("creates a topic post and testimony with Scripture, encouragement, report, and Platform moderation", async ({ page }) => {
    await signIn(page, member);
    await page.goto("/community/topics/anger/posts/new");
    await page.getByLabel("Title").fill(`${runId} topic post`);
    await page.getByLabel("Body").fill("A focused Anger post fixture.");
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page).toHaveURL(/\/community\/posts\//, { timeout: 90_000 });
    const postResult = await admin.from("community_posts").select("id").eq("title", `${runId} topic post`).single();
    expect(postResult.error).toBeNull();
    postId = postResult.data!.id;
    const topicLink = await admin.from("community_post_topics").select("topic_id").eq("post_id", postId).single();
    expect(topicLink.data?.topic_id).toBe(angerTopicId);

    await page.goto("/community/topics/anger/testimonies/new");
    await page.getByLabel("Title").fill(`${runId} testimony`);
    await page.getByLabel("What I went through").fill("I struggled with anger and needed patient discipleship.");
    await page.getByLabel("What God taught me").fill("God taught me to slow down, repent, and seek peace.");
    await page.getByLabel("Book").selectOption("JAS");
    await page.getByLabel("Chapter").fill("1");
    await page.getByRole("textbox", { name: "Verse (required)" }).fill("19");
    await page.getByLabel("Ending verse").fill("20");
    await page.getByLabel("Reflection on Scripture").fill("This is my reflection on the passage.");
    await page.getByRole("button", { name: "Share testimony" }).click();
    await expect(page).toHaveURL(/\/community\/testimonies\//, { timeout: 90_000 });
    const testimonyResult = await admin.from("community_testimonies").select("id").eq("title", `${runId} testimony`).single();
    expect(testimonyResult.error).toBeNull();
    testimonyId = testimonyResult.data!.id;
    await expect(page.getByRole("heading", { name: `${runId} testimony` })).toBeVisible();
    await expect(page.getByRole("link", { name: "James 1:19-20" })).toBeVisible();

    await page.getByRole("button", { name: "Encouraged me" }).click();
    await expect(page.getByText("1 member encouraged")).toBeVisible({ timeout: 90_000 });

    await signIn(page, reporter);
    await page.goto(`/community/testimonies/${testimonyId}`);
    await page.getByText("Report testimony").click();
    await page.getByLabel("Reason").fill(`${runId} report reason`);
    await page.getByLabel("Details").fill("Fixture report details.");
    await page.getByRole("button", { name: "Submit report" }).click();
    await expect(page.getByText("Testimony report submitted.")).toBeVisible({ timeout: 90_000 });

    await signIn(page, platform);
    await page.goto("/platform");
    await expect(page.getByRole("heading", { name: "Community testimony reports" })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(`${runId} report reason`)).toBeVisible();
    await page.getByRole("button", { name: "Resolve" }).first().click();
    await expect(page.getByText("Testimony report updated.")).toBeVisible({ timeout: 90_000 });
  });

  test("supports edit/delete, banned-user restrictions, and account deletion compatibility", async ({ page }) => {
    await signIn(page, member);
    await page.goto(`/community/testimonies/${testimonyId}/edit`);
    await page.getByLabel("Where I am now").fill("Continuing to practice repentance and patience.");
    await page.getByRole("button", { name: "Save testimony" }).click();
    await expect(page.getByText("Continuing to practice repentance and patience.")).toBeVisible({ timeout: 90_000 });

    await signIn(page, banned);
    await page.goto("/community/topics/anger/testimonies/new");
    await page.getByLabel("Title").fill(`${runId} banned testimony`);
    await page.getByLabel("What I went through").fill("Banned fixture body.");
    await page.getByLabel("What God taught me").fill("Banned fixture reflection.");
    await page.getByRole("button", { name: "Share testimony" }).click();
    await expect(page.getByText("Your account cannot share testimony right now.")).toBeVisible({ timeout: 90_000 });

    const { data: deletionSummary, error } = await admin.rpc("delete_user_account_data", { target_user_id: member.userId });
    expect(error).toBeNull();
    expect(deletionSummary).toBeTruthy();
    const scrubbed = await admin
      .from("community_testimonies")
      .select("author_id,title,what_i_went_through,deleted_at,is_published")
      .eq("id", testimonyId)
      .single();
    expect(scrubbed.error).toBeNull();
    expect(scrubbed.data?.author_id).toBeNull();
    expect(scrubbed.data?.title).toBe("Deleted testimony");
    expect(scrubbed.data?.what_i_went_through).toBe("Deleted testimony");
    expect(scrubbed.data?.deleted_at).toBeTruthy();
    expect(scrubbed.data?.is_published).toBeFalsy();
    testimonyId = "";
  });
});

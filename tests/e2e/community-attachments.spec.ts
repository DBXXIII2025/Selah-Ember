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

test.skip(!url || !anonKey || !serviceKey, "Supabase environment variables are required for Community attachment fixtures.");

const admin = createClient(url || "", serviceKey || "", {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = `community-attachments-${Date.now()}`;
const password = `CommunityAttachments!${Date.now()}`;
const authCookieName = url ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : "";
const testBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3100}`;
const testBaseHost = new URL(testBaseUrl).hostname;
const isSecureTestBase = new URL(testBaseUrl).protocol === "https:";
const imageBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

type FixtureUser = { email: string; userId: string; profileId: string };
const users: FixtureUser[] = [];
const postIds: string[] = [];
const storagePaths = new Set<string>();
let member: FixtureUser;
let other: FixtureUser;
let banned: FixtureUser;
let communityId = "";
let depressionTopicId = "";
let communityTopicSchemaAvailable = false;

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
  const { error } = await admin.from("community_topics").select("id").order("sort_order", { ascending: true }).limit(1);
  return !error;
}

async function createUser(key: string) {
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
    })
    .select("id")
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

async function getDefaultCommunityId() {
  const { data: defaultCommunity } = await admin
    .from("churches")
    .select("id")
    .eq("is_default", true)
    .eq("is_published", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (defaultCommunity?.id) return String(defaultCommunity.id);

  const { data: slugCommunity } = await admin
    .from("churches")
    .select("id")
    .eq("is_published", true)
    .eq("slug", "selah-ember-community")
    .limit(1)
    .maybeSingle();
  if (slugCommunity?.id) return String(slugCommunity.id);

  throw new Error("Default Community fixture target was not found.");
}

async function attachPng(page: Page, name: string) {
  await page.locator('input[name="media_file"]').setInputFiles({
    name,
    mimeType: "image/png",
    buffer: imageBuffer,
  });
}

async function findPostByTitle(title: string) {
  const result = await admin
    .from("community_posts")
    .select("id,author_id,created_at,media_kind,storage_path,file_name,mime_type,size_bytes")
    .eq("title", title)
    .maybeSingle();
  expect(result.error).toBeNull();
  return result.data;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
}

async function expectNoAccessibilityViolations(page: Page, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  await testInfo.attach("axe-violations", {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });
  expect(results.violations).toEqual([]);
}

test.describe.serial("Community image attachments", () => {
  test.describe.configure({ timeout: 300_000 });

  test.beforeAll(async () => {
    communityTopicSchemaAvailable = await hasCommunityTopicSchema();
    if (!communityTopicSchemaAvailable) return;
    communityId = await getDefaultCommunityId();
    const { data: depression } = await admin.from("community_topics").select("id").eq("slug", "depression").single();
    depressionTopicId = depression!.id;
    member = await createUser("member");
    other = await createUser("other");
    banned = await createUser("banned");
    await admin.from("user_bans").insert({
      banned_user_id: banned.userId,
      banned_by: null,
      reason: `${runId} media ban`,
      starts_at: new Date(Date.now() - 1000).toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  });

  test.afterAll(async () => {
    if (!communityTopicSchemaAvailable) return;
    if (postIds.length > 0) {
      const media = await admin.from("community_posts").select("storage_path").in("id", postIds);
      for (const row of media.data || []) {
        if (row.storage_path) storagePaths.add(String(row.storage_path));
      }
      await admin.from("community_post_comments").delete().in("post_id", postIds);
      await admin.from("community_post_reactions").delete().in("post_id", postIds);
      await admin.from("community_post_topics").delete().in("post_id", postIds);
      await admin.from("community_posts").delete().in("id", postIds);
    }

    if (storagePaths.size > 0) {
      await admin.storage.from("community-feed-media").remove([...storagePaths]);
    }

    for (const user of users) {
      await admin.from("user_bans").delete().eq("banned_user_id", user.userId);
      await admin.from("profiles").delete().eq("user_id", user.userId);
      await admin.auth.admin.deleteUser(user.userId);
    }
  });

  test("creates a Depression topic image post and preserves the topic relationship", async ({ page }) => {
    test.skip(!communityTopicSchemaAvailable, "Community topic migration has not been applied to the test database.");
    const title = `${runId} depression image topic post`;

    await signIn(page, member);
    await page.goto("/community/topics/depression/posts/new");
    await expect(page.getByRole("heading", { name: "Share in Depression" })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByLabel("Update type")).toHaveValue("text");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Body").fill("Image attachment should publish with the Depression topic.");
    await attachPng(page, "depression-topic.png");
    await expect(page.getByLabel("Update type")).toHaveValue("image");
    await expect(page.getByText("depression-topic.png")).toBeVisible();
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page).toHaveURL(/\/community\/posts\//, { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.locator("article").filter({ hasText: title }).locator("img").first()).toBeVisible();

    const post = await findPostByTitle(title);
    expect(post).toBeTruthy();
    postIds.push(post!.id);
    storagePaths.add(String(post!.storage_path));
    expect(post!.author_id).toBe(member.userId);
    expect(post!.media_kind).toBe("image");
    expect(post!.file_name).toBe("depression-topic.png");
    expect(post!.mime_type).toBe("image/png");
    expect(post!.size_bytes).toBe(imageBuffer.length);
    expect(String(post!.storage_path)).toMatch(new RegExp(`^${communityId}/${member.userId}/\\d+-depression-topic\\.png$`));

    const topicLink = await admin.from("community_post_topics").select("topic_id").eq("post_id", post!.id).single();
    expect(topicLink.error).toBeNull();
    expect(topicLink.data!.topic_id).toBe(depressionTopicId);

    await page.reload();
    await expect(page.locator("article").filter({ hasText: title }).locator("img").first()).toBeVisible({ timeout: 90_000 });
    await page.goto("/community");
    await expect(page.getByText(title)).toHaveCount(0);
    await page.goto("/community/topics/depression");
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.locator("article").filter({ hasText: title }).locator("img").first()).toBeVisible();
  });

  test("keeps the draft and selected attachment visible when validation fails", async ({ page }) => {
    test.skip(!communityTopicSchemaAvailable, "Community topic migration has not been applied to the test database.");
    const title = `${runId} invalid attachment draft`;

    await signIn(page, member);
    await page.goto("/community/topics/depression/posts/new");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Body").fill("This draft must remain after a rejected attachment.");
    await page.getByLabel("Image or video upload").setInputFiles({
      name: "not-an-image.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page).toHaveURL(/\/community\/topics\/depression\/posts\/new/);
    await expect(page.getByRole("alert").filter({ hasText: "Choose an image or video file" })).toBeVisible();
    await expect(page.getByLabel("Title")).toHaveValue(title);
    await expect(page.getByLabel("Body")).toHaveValue("This draft must remain after a rejected attachment.");
    await expect(page.getByText("not-an-image.txt")).toBeVisible();
    await expect(findPostByTitle(title)).resolves.toBeNull();
  });

  test("creates a General Community image post and keeps it uncategorized", async ({ page }) => {
    test.skip(!communityTopicSchemaAvailable, "Community topic migration has not been applied to the test database.");
    const title = `${runId} general image post`;

    await signIn(page, member);
    await page.goto("/community/new");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Body").fill("General Community image post fixture.");
    await attachPng(page, "general-community.png");
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page).toHaveURL(/\/community\/posts\//, { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    const post = await findPostByTitle(title);
    expect(post).toBeTruthy();
    postIds.push(post!.id);
    storagePaths.add(String(post!.storage_path));
    expect(post!.media_kind).toBe("image");
    const links = await admin.from("community_post_topics").select("topic_id").eq("post_id", post!.id);
    expect(links.error).toBeNull();
    expect(links.data || []).toHaveLength(0);

    await page.goto("/community");
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.locator("article").filter({ hasText: title }).locator("img").first()).toBeVisible();
  });

  test("editing text preserves existing image, topic, comments, and reactions", async ({ page }) => {
    test.skip(!communityTopicSchemaAvailable, "Community topic migration has not been applied to the test database.");
    const title = `${runId} edit image topic post`;
    const editedTitle = `${runId} edit image topic post updated`;

    await signIn(page, member);
    await page.goto("/community/topics/depression/posts/new");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Body").fill("Original image post body.");
    await attachPng(page, "edit-preserve.png");
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page).toHaveURL(/\/community\/posts\//, { timeout: 90_000 });

    const original = await findPostByTitle(title);
    expect(original).toBeTruthy();
    postIds.push(original!.id);
    storagePaths.add(String(original!.storage_path));
    const { data: reaction, error: reactionError } = await admin
      .from("community_post_reactions")
      .insert({ post_id: original!.id, author_id: member.userId, reaction: "like" })
      .select("id")
      .single();
    expect(reactionError).toBeNull();
    const { data: comment, error: commentError } = await admin
      .from("community_post_comments")
      .insert({ post_id: original!.id, author_id: member.userId, body: `${runId} attachment comment` })
      .select("id,created_at")
      .single();
    expect(commentError).toBeNull();

    await page.goto(`/community/posts/${original!.id}/edit`);
    await expect(page.getByText("Current file: edit-preserve.png")).toBeVisible({ timeout: 90_000 });
    await page.getByLabel("Title").fill(editedTitle);
    await page.getByLabel("Body").fill("Edited text with existing image preserved.");
    await page.getByRole("button", { name: "Save post" }).click();
    await expect(page.getByText("Post updated.")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("article").filter({ hasText: editedTitle }).locator("img").first()).toBeVisible();

    const updated = await admin
      .from("community_posts")
      .select("id,author_id,created_at,title,body,media_kind,storage_path,file_name")
      .eq("id", original!.id)
      .single();
    expect(updated.error).toBeNull();
    expect(updated.data!.id).toBe(original!.id);
    expect(updated.data!.author_id).toBe(original!.author_id);
    expect(updated.data!.created_at).toBe(original!.created_at);
    expect(updated.data!.media_kind).toBe("image");
    expect(updated.data!.storage_path).toBe(original!.storage_path);
    expect(updated.data!.file_name).toBe("edit-preserve.png");
    const topicLinks = await admin.from("community_post_topics").select("topic_id").eq("post_id", original!.id);
    expect(topicLinks.data).toEqual([{ topic_id: depressionTopicId }]);
    const reactions = await admin.from("community_post_reactions").select("id").eq("id", reaction!.id).single();
    expect(reactions.error).toBeNull();
    const comments = await admin.from("community_post_comments").select("id,post_id,created_at").eq("id", comment!.id).single();
    expect(comments.data).toEqual({ id: comment!.id, post_id: original!.id, created_at: comment!.created_at });
  });

  test("authorization and responsive accessibility remain intact", async ({ page }, testInfo) => {
    test.skip(!communityTopicSchemaAvailable, "Community topic migration has not been applied to the test database.");
    const bannedTitle = `${runId} banned image post`;
    const protectedTitle = `${runId} protected image post`;

    await signIn(page, member);
    await page.goto("/community/topics/depression/posts/new");
    await page.getByLabel("Title").fill(protectedTitle);
    await page.getByLabel("Body").fill("Protected image post fixture.");
    await attachPng(page, "protected-image.png");
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page).toHaveURL(/\/community\/posts\//, { timeout: 90_000 });
    const protectedPost = await findPostByTitle(protectedTitle);
    expect(protectedPost).toBeTruthy();
    postIds.push(protectedPost!.id);
    storagePaths.add(String(protectedPost!.storage_path));

    await signIn(page, other);
    await page.goto(`/community/posts/${protectedPost!.id}/edit`);
    await expect(page.getByRole("heading", { name: "This fellowship path is quiet" })).toBeVisible({ timeout: 90_000 });
    const unauthorizedAfter = await admin.from("community_posts").select("storage_path,title").eq("id", protectedPost!.id).single();
    expect(unauthorizedAfter.data!.storage_path).toBe(protectedPost!.storage_path);
    expect(unauthorizedAfter.data!.title).toBe(protectedTitle);

    await signIn(page, banned);
    await page.goto("/community/topics/depression/posts/new");
    await page.getByLabel("Title").fill(bannedTitle);
    await page.getByLabel("Body").fill("Banned draft should remain but not save.");
    await attachPng(page, "banned-image.png");
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Your account cannot post right now." })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByLabel("Title")).toHaveValue(bannedTitle);
    await expect(page.getByText("banned-image.png")).toBeVisible();
    await expect(findPostByTitle(bannedTitle)).resolves.toBeNull();

    await signIn(page, member);
    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/community/topics/depression/posts/new");
      await expect(page.getByRole("heading", { name: "Share in Depression" })).toBeVisible({ timeout: 90_000 });
      await attachPng(page, `mobile-${width}.png`);
      await expect(page.getByText(`mobile-${width}.png`)).toBeVisible();
      await expect(page.getByRole("button", { name: "Post" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/community/topics/depression/posts/new");
    await expectNoAccessibilityViolations(page, testInfo);
  });
});

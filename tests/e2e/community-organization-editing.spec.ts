import { expect, test, type Page } from "@playwright/test";
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

test.skip(!url || !anonKey || !serviceKey, "Supabase environment variables are required for Community organization fixtures.");

const admin = createClient(url || "", serviceKey || "", {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = `community-org-edit-${Date.now()}`;
const password = `CommunityOrgEdit!${Date.now()}`;
const authCookieName = url ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : "";
const testBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3100}`;
const testBaseHost = new URL(testBaseUrl).hostname;
const isSecureTestBase = new URL(testBaseUrl).protocol === "https:";

type FixtureUser = { email: string; userId: string; profileId: string };
const users: FixtureUser[] = [];
const postIds: string[] = [];
const topicIds: string[] = [];
let member: FixtureUser;
let platform: FixtureUser;
let communityId = "";
let angerTopicId = "";
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

  const { data: namedCommunity } = await admin
    .from("churches")
    .select("id")
    .eq("is_published", true)
    .eq("name", "Selah Ember Community")
    .limit(1)
    .maybeSingle();
  if (namedCommunity?.id) return String(namedCommunity.id);

  throw new Error("Default Community fixture target was not found.");
}

async function createCommunityPost(input: { title: string; body: string; topicId?: string }) {
  const { data, error } = await admin
    .from("community_posts")
    .insert({
      community_id: communityId,
      author_id: member.userId,
      title: input.title,
      body: input.body,
      is_published: true,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  const postId = data!.id;
  postIds.push(postId);

  if (input.topicId) {
    const { error: linkError } = await admin.from("community_post_topics").insert({
      post_id: postId,
      topic_id: input.topicId,
    });
    expect(linkError).toBeNull();
  }

  return postId;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
}

test.describe.serial("Community organization, topic management, and content editing", () => {
  test.describe.configure({ timeout: 300_000 });

  test.beforeAll(async () => {
    communityTopicSchemaAvailable = await hasCommunityTopicSchema();
    if (!communityTopicSchemaAvailable) return;
    communityId = await getDefaultCommunityId();
    const { data: anger } = await admin.from("community_topics").select("id").eq("slug", "anger").single();
    angerTopicId = anger!.id;
    member = await createUser("member");
    platform = await createUser("platform", "platform_engineer");
  });

  test.afterAll(async () => {
    for (const postId of postIds) {
      await admin.from("community_post_comments").delete().eq("post_id", postId);
      await admin.from("community_post_reactions").delete().eq("post_id", postId);
      await admin.from("community_post_topics").delete().eq("post_id", postId);
      await admin.from("community_posts").delete().eq("id", postId);
    }
    for (const topicId of topicIds) {
      await admin.from("community_topics").delete().eq("id", topicId);
    }
    for (const user of users) {
      await admin.from("user_bans").delete().eq("banned_user_id", user.userId);
      await admin.from("profiles").delete().eq("user_id", user.userId);
      await admin.auth.admin.deleteUser(user.userId);
    }
  });

  test("Community Home is topic-first and General Community excludes topic posts", async ({ page }) => {
    test.skip(!communityTopicSchemaAvailable, "Community topic migration has not been applied to the test database.");
    await createCommunityPost({
      title: `${runId} general post`,
      body: "This post has no Community topic association.",
    });
    await createCommunityPost({
      title: `${runId} anger topic post`,
      body: "This post belongs only to Anger.",
      topicId: angerTopicId,
    });
    const { data: inactive, error: inactiveError } = await admin
      .from("community_topics")
      .insert({
        slug: `${runId}-inactive`.replace(/[^a-z0-9-]/g, "-"),
        name: `${runId} inactive`,
        description: "Fixture inactive topic.",
        sort_order: 9999,
        is_active: false,
      })
      .select("id")
      .single();
    expect(inactiveError).toBeNull();
    topicIds.push(inactive!.id);
    const orderedTopics = await admin
      .from("community_topics")
      .insert([
        {
          slug: `${runId}-sort-first`.replace(/[^a-z0-9-]/g, "-"),
          name: `${runId} sort first`,
          description: "First ordered fixture topic.",
          sort_order: -9999,
          is_active: true,
        },
        {
          slug: `${runId}-sort-second`.replace(/[^a-z0-9-]/g, "-"),
          name: `${runId} sort second`,
          description: "Second ordered fixture topic.",
          sort_order: -9998,
          is_active: true,
        },
      ])
      .select("id,slug")
      .order("sort_order", { ascending: true });
    if (orderedTopics.error?.code === "42703") {
      test.skip(true, "Community topic migration has not been applied to the test database.");
    }
    expect(orderedTopics.error).toBeNull();
    topicIds.push(...(orderedTopics.data || []).map((topic) => topic.id));
    const forgivenessBefore = await admin.from("community_topics").select("id,slug").eq("slug", "forgiveness").single();
    expect(forgivenessBefore.error).toBeNull();

    await page.goto("/community");
    await expect(page.getByRole("heading", { level: 1, name: "Selah Ember Community" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Find a topic" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Testimonies" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Topics", exact: true })).toHaveCount(0);
    await expect(page.locator('a[href="/community/topics/anger"]').first()).toBeVisible();
    await expect(page.locator('a[href="/community/topics/forgiveness"]').first()).toContainText("Unforgiveness");
    await expect(page.getByText(`${runId} inactive`)).toHaveCount(0);
    const topicLinks = page.locator('section[aria-label="Community topics"] a[href^="/community/topics/"]');
    await expect(topicLinks.nth(0)).toContainText(`${runId} sort first`);
    await expect(topicLinks.nth(1)).toContainText(`${runId} sort second`);
    await expect(page.getByRole("heading", { name: "General Community" })).toBeVisible();
    await expect(page.getByText(`${runId} general post`)).toBeVisible();
    await expect(page.getByText(`${runId} anger topic post`)).toHaveCount(0);

    await page.goto("/community/topics/anger");
    await expect(page.getByText(`${runId} anger topic post`)).toBeVisible();
    await expect(page.getByText(`${runId} general post`)).toHaveCount(0);

    await page.goto("/community/topics/anxiety-fear");
    await expect(page.getByText(`${runId} anger topic post`)).toHaveCount(0);
    const forgivenessAfter = await admin.from("community_topics").select("id,slug").eq("slug", "forgiveness").single();
    expect(forgivenessAfter.data).toEqual(forgivenessBefore.data);

    for (const width of [320, 360, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/community");
      await expectNoHorizontalOverflow(page);
    }
  });

  test("Platform Engineer can create, edit, reorder, mark sensitive, deactivate, and reactivate a topic", async ({ page }) => {
    test.skip(!communityTopicSchemaAvailable, "Community topic migration has not been applied to the test database.");
    await signIn(page, platform);
    await page.goto("/platform");
    await expect(page.getByRole("heading", { name: "Community Topics" })).toBeVisible({ timeout: 90_000 });

    const topicName = `${runId} Platform Topic`;
    const createForm = page.locator("form").filter({ has: page.getByRole("heading", { name: "Create topic" }) });
    await createForm.getByLabel("Topic name").fill(topicName);
    await createForm.getByLabel("Sort order").fill("777");
    await createForm.getByLabel("Description").fill("Fixture topic managed through Platform.");
    await createForm.getByLabel("Sensitive").check();
    await createForm.getByRole("button", { name: "Create topic" }).click();
    await expect(page.getByText("Community topic created.")).toBeVisible({ timeout: 90_000 });

    const created = await admin.from("community_topics").select("id,slug").eq("name", topicName).single();
    expect(created.error).toBeNull();
    topicIds.push(created.data!.id);

    const updateForm = page.locator("form").filter({ hasText: topicName }).first();
    await updateForm.getByLabel("Topic name").fill(`${topicName} Updated`);
    await updateForm.getByLabel("Sort order").fill("778");
    await updateForm.getByLabel("Description").fill("Updated fixture topic description.");
    await updateForm.getByLabel("Active").uncheck();
    await updateForm.getByRole("button", { name: "Update topic" }).click();
    await expect(page.getByText("Community topic updated.")).toBeVisible({ timeout: 90_000 });

    const updated = await admin
      .from("community_topics")
      .select("slug,name,description,sort_order,is_sensitive,is_active")
      .eq("id", created.data!.id)
      .single();
    expect(updated.error).toBeNull();
    expect(updated.data!.slug).toBe(created.data!.slug);
    expect(updated.data!.name).toBe(`${topicName} Updated`);
    expect(updated.data!.description).toBe("Updated fixture topic description.");
    expect(updated.data!.sort_order).toBe(778);
    expect(updated.data!.is_sensitive).toBe(true);
    expect(updated.data!.is_active).toBe(false);

    await page.goto("/community");
    await expect(page.getByText(`${topicName} Updated`)).toHaveCount(0);

    await page.goto("/platform");
    const reactivateForm = page.locator("form").filter({ hasText: `${topicName} Updated` }).first();
    await reactivateForm.getByLabel("Active").check();
    await reactivateForm.getByRole("button", { name: "Update topic" }).click();
    await expect(page.getByText("Community topic updated.")).toBeVisible({ timeout: 90_000 });
    await expect.poll(async () => {
      const { data } = await admin.from("community_topics").select("is_active").eq("id", created.data!.id).single();
      return data?.is_active;
    }).toBe(true);
  });

});

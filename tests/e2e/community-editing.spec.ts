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

test.skip(!url || !anonKey || !serviceKey, "Supabase environment variables are required for Community editing fixtures.");

const admin = createClient(url || "", serviceKey || "", {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = `community-edit-${Date.now()}`;
const password = `CommunityEdit!${Date.now()}`;
const authCookieName = url ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : "";
const testBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3100}`;
const testBaseHost = new URL(testBaseUrl).hostname;
const isSecureTestBase = new URL(testBaseUrl).protocol === "https:";

type FixtureUser = { email: string; userId: string; profileId: string };
const users: FixtureUser[] = [];
const postIds: string[] = [];
let member: FixtureUser;
let other: FixtureUser;
let banned: FixtureUser;
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

async function hasCommunityTopicSchema() {
  const { error } = await admin.from("community_topics").select("id").order("sort_order", { ascending: true }).limit(1);
  return !error;
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

async function createCommunityPost(input: { title: string; body: string; topicId?: string; authorId?: string }) {
  const { data, error } = await admin
    .from("community_posts")
    .insert({
      community_id: communityId,
      author_id: input.authorId || member.userId,
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

test.describe.serial("Community post and comment editing", () => {
  test.describe.configure({ timeout: 300_000 });

  test.beforeAll(async () => {
    communityTopicSchemaAvailable = await hasCommunityTopicSchema();
    if (!communityTopicSchemaAvailable) return;
    communityId = await getDefaultCommunityId();
    const { data: anger } = await admin.from("community_topics").select("id").eq("slug", "anger").single();
    angerTopicId = anger!.id;
    member = await createUser("member");
    other = await createUser("other");
    banned = await createUser("banned");
  });

  test.afterAll(async () => {
    for (const postId of postIds) {
      await admin.from("community_post_comments").delete().eq("post_id", postId);
      await admin.from("community_post_reactions").delete().eq("post_id", postId);
      await admin.from("community_post_topics").delete().eq("post_id", postId);
      await admin.from("community_posts").delete().eq("id", postId);
    }
    for (const user of users) {
      await admin.from("user_bans").delete().eq("banned_user_id", user.userId);
      await admin.from("profiles").delete().eq("user_id", user.userId);
      await admin.auth.admin.deleteUser(user.userId);
    }
  });

  test("authors can edit Community posts and comments without changing relationships", async ({ page }) => {
    test.skip(!communityTopicSchemaAvailable, "Community topic migration has not been applied to the test database.");
    const generalPostId = await createCommunityPost({
      title: `${runId} editable general post`,
      body: "Editable General Community body.",
    });
    const topicPostId = await createCommunityPost({
      title: `${runId} editable anger topic post`,
      body: "Editable Anger topic body.",
      topicId: angerTopicId,
    });
    const otherPostId = await createCommunityPost({
      title: `${runId} other author post`,
      body: "Other author body must not be changed by tampering.",
      authorId: other.userId,
    });
    const bannedPostId = await createCommunityPost({
      title: `${runId} banned author post`,
      body: "Banned author body must not be changed.",
      authorId: banned.userId,
    });
    const { data: reaction, error: reactionError } = await admin
      .from("community_post_reactions")
      .insert({ post_id: generalPostId, author_id: member.userId, reaction: "like" })
      .select("id")
      .single();
    expect(reactionError).toBeNull();
    const { data: comment, error: commentError } = await admin
      .from("community_post_comments")
      .insert({ post_id: generalPostId, author_id: member.userId, body: `${runId} original comment` })
      .select("id,created_at")
      .single();
    expect(commentError).toBeNull();

    const originalGeneral = await admin.from("community_posts").select("id,author_id,created_at").eq("id", generalPostId).single();
    const originalTopic = await admin.from("community_posts").select("id,author_id,created_at").eq("id", topicPostId).single();

    await signIn(page, member);
    await page.goto(`/community/posts/${generalPostId}/edit`);
    await expect(page.getByRole("heading", { name: "Edit post" })).toBeVisible({ timeout: 90_000 });
    await page.getByLabel("Title").fill(`${runId} general post edited`);
    await page.getByLabel("Body").fill("Edited General Community body.");
    await page.getByRole("button", { name: "Save post" }).click();
    await expect(page.getByText("Post updated.")).toBeVisible({ timeout: 90_000 });

    await page.goto(`/community/posts/${topicPostId}/edit`);
    await expect(page.getByRole("heading", { name: "Edit post" })).toBeVisible({ timeout: 90_000 });
    await page.getByLabel("Title").fill(`${runId} anger topic post edited`);
    await page.getByLabel("Body").fill("Edited Anger topic body.");
    await page.getByRole("button", { name: "Save post" }).click();
    await expect(page.getByText("Post updated.")).toBeVisible({ timeout: 90_000 });

    await page.goto(`/community/posts/${generalPostId}`);
    await page.locator("article").filter({ hasText: `${runId} original comment` }).locator("summary").click();
    await page.getByLabel("Edit comment").fill(`${runId} edited comment`);
    await page.getByRole("button", { name: "Save comment" }).click();
    await expect(page.getByText("Comment updated.")).toBeVisible({ timeout: 90_000 });

    const generalAfter = await admin.from("community_posts").select("id,author_id,created_at,title,body").eq("id", generalPostId).single();
    const topicAfter = await admin.from("community_posts").select("id,author_id,created_at,title,body").eq("id", topicPostId).single();
    expect(generalAfter.data!.id).toBe(originalGeneral.data!.id);
    expect(generalAfter.data!.author_id).toBe(originalGeneral.data!.author_id);
    expect(generalAfter.data!.created_at).toBe(originalGeneral.data!.created_at);
    expect(topicAfter.data!.id).toBe(originalTopic.data!.id);
    expect(topicAfter.data!.author_id).toBe(originalTopic.data!.author_id);
    expect(topicAfter.data!.created_at).toBe(originalTopic.data!.created_at);

    const generalLinks = await admin.from("community_post_topics").select("topic_id").eq("post_id", generalPostId);
    expect(generalLinks.data || []).toHaveLength(0);
    const topicLinks = await admin.from("community_post_topics").select("topic_id").eq("post_id", topicPostId);
    expect(topicLinks.data).toEqual([{ topic_id: angerTopicId }]);
    const comments = await admin.from("community_post_comments").select("id,post_id,author_id,created_at,body").eq("id", comment!.id).single();
    expect(comments.data!.post_id).toBe(generalPostId);
    expect(comments.data!.body).toBe(`${runId} edited comment`);
    expect(comments.data!.created_at).toBe(comment!.created_at);
    const reactions = await admin.from("community_post_reactions").select("id").eq("id", reaction!.id).single();
    expect(reactions.error).toBeNull();

    await page.goto("/community");
    await expect(page.getByText(`${runId} general post edited`)).toBeVisible();
    await expect(page.getByText(`${runId} anger topic post edited`)).toHaveCount(0);
    await page.goto("/community/topics/anger");
    await expect(page.getByText(`${runId} anger topic post edited`)).toBeVisible();

    await signIn(page, other);
    await page.goto(`/community/posts/${generalPostId}/edit`);
    await expect(page.getByRole("heading", { name: "This fellowship path is quiet" })).toBeVisible();
    await expect(page.getByLabel("Title")).toHaveCount(0);
    await page.goto(`/community/posts/${generalPostId}`);
    await expect(page.getByText("Edit comment")).toHaveCount(0);

    await page.context().clearCookies();
    await page.goto(`/community/posts/${generalPostId}/edit`);
    await expect(page).toHaveURL(/\/signin/, { timeout: 90_000 });

    await signIn(page, banned);
    await admin.from("user_bans").insert({
      banned_user_id: banned.userId,
      banned_by: null,
      reason: `${runId} edit ban`,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    await page.goto(`/community/posts/${bannedPostId}/edit`);
    await expect(page.getByRole("heading", { name: "Edit post" })).toBeVisible({ timeout: 90_000 });
    await page.getByLabel("Body").fill("Banned edit should not persist.");
    await page.getByRole("button", { name: "Save post" }).click();
    await expect(page.getByText("Your account cannot edit posts right now.")).toBeVisible({ timeout: 90_000 });
    const bannedAfter = await admin.from("community_posts").select("body").eq("id", bannedPostId).single();
    expect(bannedAfter.data!.body).toBe("Banned author body must not be changed.");

    await signIn(page, member);
    await page.goto(`/community/posts/${otherPostId}/edit`);
    await expect(page.getByRole("heading", { name: "This fellowship path is quiet" })).toBeVisible({ timeout: 90_000 });
    const tamperedAfter = await admin.from("community_posts").select("body").eq("id", otherPostId).single();
    expect(tamperedAfter.data!.body).toBe("Other author body must not be changed by tampering.");
  });
});

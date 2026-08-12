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

test.skip(!url || !anonKey || !serviceKey, "Supabase environment variables are required for reaction fixtures.");

const admin = createClient(url || "", serviceKey || "", {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = `reaction-password-${Date.now()}`;
const password = `ReactionPassword!${Date.now()}`;
const authCookieName = url ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : "";
const testBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3100}`;
const testBaseHost = new URL(testBaseUrl).hostname;
const isSecureTestBase = new URL(testBaseUrl).protocol === "https:";
const users: Array<{ userId: string; profileId: string; email: string }> = [];
let postId = "";
let testimonyId = "";
let messageId = "";
let conversationId = "";

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
  const email = `${runId}-${key}@gmail.com`;
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

  const user = { userId: userData.user.id, profileId: profile.id, email };
  users.push(user);
  return user;
}

async function signIn(page: Page, user: { email: string }) {
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

test.describe.serial("reaction latency and password visibility", () => {
  test.describe.configure({ timeout: 240_000 });

  test.afterAll(async () => {
    if (testimonyId) {
      await admin.from("community_testimony_encouragements").delete().eq("testimony_id", testimonyId);
      await admin.from("community_testimonies").delete().eq("id", testimonyId);
    }
    if (postId) {
      await admin.from("community_post_reactions").delete().eq("post_id", postId);
      await admin.from("community_posts").delete().eq("id", postId);
    }
    if (messageId) {
      await admin.from("message_reactions").delete().eq("message_id", messageId);
      await admin.from("direct_messages").delete().eq("id", messageId);
    }
    if (conversationId) {
      await admin.from("conversation_participants").delete().eq("conversation_id", conversationId);
      await admin.from("conversations").delete().eq("id", conversationId);
    }
    for (const user of users) {
      await admin.from("user_bans").delete().eq("banned_user_id", user.userId);
      await admin.from("profiles").delete().eq("user_id", user.userId);
      await admin.auth.admin.deleteUser(user.userId);
    }
  });

  test("sign-in password visibility toggle preserves value and does not submit", async ({ page }) => {
    await page.goto("/signin");
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    await expect(passwordInput).toHaveAttribute("type", "password");
    await passwordInput.fill("SecretValue!123");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    await expect(passwordInput).toHaveValue("SecretValue!123");
    await expect(page).toHaveURL(/\/signin$/);

    await page.getByRole("button", { name: "Hide password" }).press("Enter");
    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(passwordInput).toHaveValue("SecretValue!123");
  });

  test("community post reactions update immediately, persist, remove, and avoid duplicates", async ({ page }) => {
    const member = await createUser("post-member");
    await signIn(page, member);
    await page.goto("/community/new");
    await page.getByLabel("Title").fill(`${runId} immediate reaction post`);
    await page.getByLabel("Body").fill("Reaction latency fixture.");
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page).toHaveURL(/\/community\/posts\//, { timeout: 90_000 });
    const postResult = await admin.from("community_posts").select("id").eq("title", `${runId} immediate reaction post`).single();
    expect(postResult.error).toBeNull();
    postId = postResult.data!.id;

    const likeButton = page.getByRole("button", { name: /Add Like reaction, 0 reactions/ });
    await likeButton.click();
    await expect(page.getByRole("button", { name: /Remove Like reaction, 1 reaction/ })).toBeVisible({ timeout: 300 });

    await expect.poll(async () => {
      const { count } = await admin
        .from("community_post_reactions")
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId)
        .eq("author_id", member.userId)
        .eq("reaction", "like");
      return count;
    }, { timeout: 30_000 }).toBe(1);

    await page.reload();
    await expect(page.getByRole("button", { name: /Remove Like reaction, 1 reaction/ })).toBeVisible();
    await page.getByRole("button", { name: /Remove Like reaction, 1 reaction/ }).click();
    await expect(page.getByRole("button", { name: /Add Like reaction, 0 reactions/ })).toBeVisible({ timeout: 300 });
    await expect.poll(async () => {
      const { count } = await admin
        .from("community_post_reactions")
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId)
        .eq("author_id", member.userId)
        .eq("reaction", "like");
      return count;
    }, { timeout: 30_000 }).toBe(0);
  });

  test("testimony encouragement updates immediately and persists after refresh", async ({ page }) => {
    const member = await createUser("testimony-member");
    const { data: anger } = await admin.from("community_topics").select("id").eq("slug", "anger").single();
    expect(anger?.id).toBeTruthy();
    const { data, error } = await admin
      .from("community_testimonies")
      .insert({
        author_id: member.userId,
        topic_id: anger!.id,
        title: `${runId} immediate encouragement testimony`,
        what_i_went_through: "A testimony encouragement latency fixture.",
        what_god_taught_me: "I learned to receive encouragement patiently.",
        is_published: true,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    testimonyId = data!.id;

    await signIn(page, member);
    await page.goto(`/community/testimonies/${testimonyId}`);
    await page.getByRole("button", { name: "Encouraged me" }).click();
    await expect(page.getByText("1 member encouraged")).toBeVisible({ timeout: 300 });

    await expect.poll(async () => {
      const { count } = await admin
        .from("community_testimony_encouragements")
        .select("testimony_id", { count: "exact", head: true })
        .eq("testimony_id", testimonyId)
        .eq("author_id", member.userId);
      return count;
    }, { timeout: 30_000 }).toBe(1);

    await page.reload();
    await expect(page.getByText("1 member encouraged")).toBeVisible();
  });

  test("direct-message reactions update immediately and persist after refresh", async ({ page }) => {
    const sender = await createUser("message-sender");
    const recipient = await createUser("message-recipient");
    const { data: conversation, error: conversationError } = await admin
      .from("conversations")
      .insert({})
      .select("id")
      .single();
    expect(conversationError).toBeNull();
    conversationId = conversation!.id;
    const { error: participantError } = await admin.from("conversation_participants").insert([
      { conversation_id: conversationId, user_id: sender.userId, last_read_at: new Date().toISOString() },
      { conversation_id: conversationId, user_id: recipient.userId },
    ]);
    expect(participantError).toBeNull();
    const { data: message, error: messageError } = await admin
      .from("direct_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: recipient.userId,
        body: "Message reaction latency fixture.",
      })
      .select("id")
      .single();
    expect(messageError).toBeNull();
    messageId = message!.id;

    await signIn(page, sender);
    await page.goto(`/messages/${conversationId}`);
    await page.getByRole("button", { name: "Add reaction" }).click();
    await page.getByTestId(`message-reaction-option-${messageId}-0`).click();
    await expect(page.getByTestId(`message-reaction-chip-${messageId}-0`).getByText("1")).toBeVisible({ timeout: 300 });

    await expect.poll(async () => {
      const { count } = await admin
        .from("message_reactions")
        .select("id", { count: "exact", head: true })
        .eq("message_id", messageId)
        .eq("user_id", sender.userId);
      return count;
    }, { timeout: 30_000 }).toBe(1);

    await page.reload();
    await expect(page.getByTestId(`message-reaction-chip-${messageId}-0`).getByText("1")).toBeVisible();
  });
});

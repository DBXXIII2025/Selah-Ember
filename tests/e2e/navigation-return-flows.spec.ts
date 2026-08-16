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

test.skip(!url || !anonKey || !serviceKey, "Supabase environment variables are required for navigation fixtures.");

const admin = createClient(url || "", serviceKey || "", {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = `navigation-return-${Date.now()}`;
const password = `NavigationReturn!${Date.now()}`;
const authCookieName = url ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : "";
const testBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3100}`;
const testBaseHost = new URL(testBaseUrl).hostname;
const isSecureTestBase = new URL(testBaseUrl).protocol === "https:";

type FixtureUser = { email: string; userId: string; profileId: string };

const users: FixtureUser[] = [];
const prayerIds: string[] = [];
const postIds: string[] = [];
const testimonyIds: string[] = [];
const groupIds: string[] = [];
const studyRoomIds: string[] = [];
const eventIds: string[] = [];
const conversationIds: string[] = [];
let member: FixtureUser;
let platform: FixtureUser;
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

async function hasCommunityTopicSchema() {
  const { error } = await admin.from("community_topics").select("id").order("sort_order", { ascending: true }).limit(1);
  return !error;
}

async function hasColumn(table: string, column: string) {
  const { error } = await admin.from(table).select(column).limit(1);
  return !error;
}

async function assertDefaultCommunityExists() {
  const { data: defaultCommunity } = await admin
    .from("churches")
    .select("id")
    .eq("is_default", true)
    .eq("is_published", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (defaultCommunity?.id) return;

  const { data: slugCommunity } = await admin
    .from("churches")
    .select("id")
    .eq("is_published", true)
    .eq("slug", "selah-ember-community")
    .limit(1)
    .maybeSingle();
  if (slugCommunity?.id) return;

  throw new Error("Default Community fixture target was not found.");
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

async function createStudyRoom(name: string, ownerProfileId: string) {
  const { data: roomId, error } = await admin.rpc("create_study_room_with_owner", {
    room_name: name,
    room_description: "Disposable navigation return Study Room.",
    room_cover_image_url: null,
    room_study_topic: "Romans",
    room_primary_bible_book: "Romans",
    room_current_scripture_reference: "Romans 8",
    room_pinned_scripture_reference: "Romans 8:28",
    room_visibility: "public",
    room_membership_mode: "open_join",
    owner_profile_id: ownerProfileId,
  });
  expect(error).toBeNull();
  studyRoomIds.push(String(roomId));
  return String(roomId);
}

async function createEventFixture(title: string, communityId: string, profileId: string) {
  const supportsEventTime = await hasColumn("events", "event_time");
  const supportsCommunityId = await hasColumn("events", "community_id");
  const eventTime = new Date(Date.now() + 86_400_000).toISOString();
  const payload: Record<string, string | null> = {
    title,
    description: "Disposable navigation return event.",
    starts_at: eventTime,
    location: "Navigation fixture",
    church_id: communityId,
    created_by: profileId,
  };

  if (supportsEventTime) payload.event_time = eventTime;
  if (supportsCommunityId) payload.community_id = communityId;

  const { data, error } = await admin.from("events").insert(payload).select("id").single();
  expect(error).toBeNull();
  eventIds.push(data!.id);
  return data!.id;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
}

async function clickAndWaitForUrl(page: Page, linkName: string, url: RegExp) {
  const link = page.getByRole("link", { name: linkName });
  if (!(await link.isVisible({ timeout: 45_000 }).catch(() => false))) {
    await page.reload();
    await expect(link).toBeVisible({ timeout: 45_000 });
  }
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  await link.click();
  if (!(await page.waitForURL(url, { timeout: 10_000 }).then(() => true).catch(() => false))) {
    await page.goto(href!, { waitUntil: "domcontentloaded", timeout: 45_000 });
  }
  await expect(page).toHaveURL(url, { timeout: 45_000 });
}

test.describe.serial("Navigation return flows", () => {
  test.describe.configure({ timeout: 300_000 });

  test.beforeAll(async () => {
    communityTopicSchemaAvailable = await hasCommunityTopicSchema();
    await assertDefaultCommunityExists();
    member = await createUser("member");
    await createUser("other");
    platform = await createUser("platform", "platform_engineer");
  });

  test.afterAll(async () => {
    if (conversationIds.length > 0) {
      await admin.from("message_attachments").delete().in("conversation_id", conversationIds);
      await admin.from("direct_messages").delete().in("conversation_id", conversationIds);
      await admin.from("conversation_participants").delete().in("conversation_id", conversationIds);
      await admin.from("conversations").delete().in("id", conversationIds);
    }
    if (groupIds.length > 0) {
      const threadResult = await admin.from("discussion_threads").select("id").in("group_id", groupIds);
      const threadIds = (threadResult.data || []).map((thread) => String(thread.id));
      if (threadIds.length > 0) {
        await admin.from("discussion_replies").delete().in("thread_id", threadIds);
      }
      await admin.from("discussion_threads").delete().in("group_id", groupIds);
      await admin.from("group_memberships").delete().in("group_id", groupIds);
      await admin.from("study_groups").delete().in("id", groupIds);
    }
    if (studyRoomIds.length > 0) {
      await admin.from("study_rooms").delete().in("id", studyRoomIds);
    }
    if (eventIds.length > 0) {
      await admin.from("event_rsvps").delete().in("event_id", eventIds);
      await admin.from("events").delete().in("id", eventIds);
    }
    if (postIds.length > 0) {
      await admin.from("community_post_comments").delete().in("post_id", postIds);
      await admin.from("community_post_reactions").delete().in("post_id", postIds);
      await admin.from("community_post_topics").delete().in("post_id", postIds);
      await admin.from("community_posts").delete().in("id", postIds);
    }
    if (testimonyIds.length > 0) {
      await admin.from("community_testimony_reports").delete().in("testimony_id", testimonyIds);
      await admin.from("community_testimony_encouragements").delete().in("testimony_id", testimonyIds);
      await admin.from("community_testimonies").delete().in("id", testimonyIds);
    }
    if (prayerIds.length > 0) {
      await admin.from("prayer_requests").delete().in("id", prayerIds);
    }
    for (const user of users) {
      await admin.from("profiles").delete().eq("user_id", user.userId);
      await admin.auth.admin.deleteUser(user.userId);
    }
  });

  test("Prayer create returns to Prayer and exposes a stable back control", async ({ page }) => {
    const title = `${runId} prayer`;

    await signIn(page, member);
    await page.goto("/prayer/new");
    await clickAndWaitForUrl(page, "Go back to Prayer", /\/prayer$/);

    await page.goto("/prayer/new");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Prayer request").fill("Please pray over this navigation fixture.");
    await page.getByRole("button", { name: "Create request" }).click();
    await expect(page).toHaveURL(/\/prayer\?message=Prayer/, { timeout: 90_000 });
    await expect(page.getByText("Prayer request created.")).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();

    const { data, error } = await admin.from("prayer_requests").select("id").eq("title", title).single();
    expect(error).toBeNull();
    prayerIds.push(data!.id);
  });

  test("Community general and topic post creation return to the originating context", async ({ page }) => {
    test.skip(!communityTopicSchemaAvailable, "Community topic migration has not been applied to the test database.");
    const generalTitle = `${runId} general post`;
    const topicTitle = `${runId} depression post`;

    await signIn(page, member);
    await page.goto("/community/new");
    await clickAndWaitForUrl(page, "Go back to Community", /\/community$/);

    await page.goto("/community/new");
    await page.getByLabel("Title").fill(generalTitle);
    await page.getByLabel("Body").fill("General Community navigation fixture.");
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page).toHaveURL(/\/community(?:\?|$)/, { timeout: 90_000 });
    await expect(page.getByText("Post shared.")).toBeVisible();
    await expect(page.getByText(generalTitle)).toBeVisible();

    const general = await admin.from("community_posts").select("id").eq("title", generalTitle).single();
    expect(general.error).toBeNull();
    postIds.push(general.data!.id);
    const generalTopics = await admin.from("community_post_topics").select("topic_id").eq("post_id", general.data!.id);
    expect(generalTopics.error).toBeNull();
    expect(generalTopics.data || []).toHaveLength(0);

    await page.goto("/community/topics/depression/posts/new");
    await clickAndWaitForUrl(page, "Go back to Depression", /\/community\/topics\/depression$/);

    await page.goto("/community/topics/depression/posts/new");
    await page.getByLabel("Title").fill(topicTitle);
    await page.getByLabel("Body").fill("Depression topic navigation fixture.");
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page).toHaveURL(/\/community\/topics\/depression(?:\?|$)/, { timeout: 90_000 });
    await expect(page.getByText("Post shared.")).toBeVisible();
    await expect(page.getByText(topicTitle)).toBeVisible();

    const topic = await admin.from("community_posts").select("id").eq("title", topicTitle).single();
    expect(topic.error).toBeNull();
    postIds.push(topic.data!.id);
    const topicLinks = await admin.from("community_post_topics").select("topic_id").eq("post_id", topic.data!.id);
    expect(topicLinks.error).toBeNull();
    expect(topicLinks.data || []).toHaveLength(1);

    await page.goto(`/community/posts/${topic.data!.id}/edit`);
    await clickAndWaitForUrl(page, "Go back to post", new RegExp(`/community/posts/${topic.data!.id}$`));
  });

  test("Testimony creation returns to topic context and editing returns to testimony detail", async ({ page }) => {
    test.skip(!communityTopicSchemaAvailable, "Community topic migration has not been applied to the test database.");
    const testimonyTitle = `${runId} testimony`;
    const editedTitle = `${runId} testimony edited`;

    await signIn(page, member);
    await page.goto("/community/topics/depression/testimonies/new");
    await clickAndWaitForUrl(page, "Go back to Depression", /\/community\/topics\/depression$/);

    await page.goto("/community/topics/depression/testimonies/new");
    await page.getByLabel("Title").fill(testimonyTitle);
    await page.getByLabel("What I went through").fill("A testimony navigation fixture.");
    await page.getByLabel("What happened").fill("The testimony was shared from a topic page.");
    await page.getByRole("button", { name: "Share testimony" }).click();
    await expect(page).toHaveURL(/\/community\/topics\/depression(?:\?|$)/, { timeout: 90_000 });
    await expect(page.getByText("Testimony shared.")).toBeVisible();

    const testimony = await admin.from("community_testimonies").select("id").eq("title", testimonyTitle).single();
    expect(testimony.error).toBeNull();
    testimonyIds.push(testimony.data!.id);

    await page.goto(`/community/testimonies/${testimony.data!.id}`);
    await clickAndWaitForUrl(page, "Go back to Depression", /\/community\/topics\/depression$/);
    await page.goto(`/community/testimonies/${testimony.data!.id}/edit`);
    await clickAndWaitForUrl(page, "Go back to testimony", new RegExp(`/community/testimonies/${testimony.data!.id}$`));

    await page.goto(`/community/testimonies/${testimony.data!.id}/edit`);
    await page.getByLabel("Title").fill(editedTitle);
    await page.getByRole("button", { name: "Save testimony" }).click();
    await expect(page).toHaveURL(new RegExp(`/community/testimonies/${testimony.data!.id}$`), { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: editedTitle })).toBeVisible();
  });

  test("Groups and Messages expose logical return controls", async ({ page }) => {
    const groupTitle = `${runId} group`;

    await signIn(page, member);
    await page.goto("/groups/new");
    await clickAndWaitForUrl(page, "Go back to Groups", /\/groups$/);

    await page.goto("/groups/new");
    await page.getByLabel("Title").fill(groupTitle);
    await page.getByLabel("Description").fill("Navigation fixture group.");
    await page.getByRole("button", { name: "Create group" }).click();
    await expect(page).toHaveURL(/\/groups$/, { timeout: 90_000 });
    await expect(page.getByText(groupTitle)).toBeVisible();
    const group = await admin.from("study_groups").select("id").eq("title", groupTitle).single();
    expect(group.error).toBeNull();
    groupIds.push(group.data!.id);

    await page.goto(`/groups/${group.data!.id}`);
    await clickAndWaitForUrl(page, "Go back to Groups", /\/groups$/);
    await page.goto(`/groups/${group.data!.id}/discussions`);
    await clickAndWaitForUrl(page, `Go back to ${groupTitle}`, new RegExp(`/groups/${group.data!.id}$`));
    await page.goto(`/groups/${group.data!.id}/discussions/new`);
    await clickAndWaitForUrl(page, "Go back to discussions", new RegExp(`/groups/${group.data!.id}/discussions$`));
    await page.goto(`/groups/${group.data!.id}/discussions/new`);
    await page.getByLabel("Title").fill(`${runId} group thread`);
    await page.getByLabel("Body").fill("Group discussion navigation fixture.");
    await page.getByRole("button", { name: "Create thread" }).click();
    await expect(page).toHaveURL(new RegExp(`/groups/${group.data!.id}/discussions\\?message=Thread`), { timeout: 90_000 });

    await page.goto("/messages/new");
    await clickAndWaitForUrl(page, "Go back to Messages", /\/messages$/);
    await page.goto(`/messages/new?q=${encodeURIComponent(runId)}`);
    await page.getByRole("button", { name: "Message" }).first().click();
    await expect(page).toHaveURL(/\/messages\/[0-9a-f-]+$/, { timeout: 90_000 });
    const conversationId = page.url().split("/messages/")[1].split(/[?#]/)[0];
    conversationIds.push(conversationId);
    await clickAndWaitForUrl(page, "Go back to Messages", /\/messages$/);
  });

  test("Study Rooms and Events expose logical return controls", async ({ page }) => {
    const roomName = `${runId} Study Room`;
    const roomThreadTitle = `${runId} Room discussion`;
    const eventTitle = `${runId} event`;

    await signIn(page, member);
    const roomId = await createStudyRoom(roomName, member.profileId);
    await page.goto(`/study-rooms/${roomId}?section=discussion`);
    await expect(page.getByRole("link", { name: "Go back to Study Rooms" })).toHaveAttribute("href", "/study-rooms");
    await page.getByLabel("Title").last().fill(roomThreadTitle);
    await page.getByLabel("Body").last().fill("Study Room discussion navigation fixture.");
    await page.getByRole("button", { name: "Start Discussion" }).click();
    await expect(page).toHaveURL(new RegExp(`/study-rooms/${roomId}\\?section=discussion&message=Discussion`), { timeout: 90_000 });
    await expect(page.getByText("Discussion started.")).toBeVisible();
    await expect(page.getByText(roomThreadTitle)).toBeVisible();

    await page.goto("/study-rooms/new");
    await expect(page.getByRole("link", { name: "Go back to Study Rooms" }).first()).toHaveAttribute("href", "/study-rooms");
    await page.goto("/events/new");
    await expect(page.getByRole("link", { name: "Go back to Events" }).first()).toHaveAttribute("href", "/events");
    const eventId = await createEventFixture(eventTitle, await getDefaultCommunityId(), member.profileId);
    await page.goto(`/events/${eventId}`);
    await clickAndWaitForUrl(page, "Go back to Events", /\/events$/);
  });

  test("Platform, Profile, and protected access expose logical return controls", async ({ page }) => {
    await signIn(page, platform);
    await page.goto("/platform/messages");
    await expect(page.getByRole("link", { name: "Go back to Platform" })).toHaveAttribute("href", "/platform");
    await page.goto("/platform/leader-applications");
    await expect(page.getByRole("link", { name: "Go back to Platform" })).toHaveAttribute("href", "/platform");

    await signIn(page, member);
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
    await page.goto("/delete-account");
    await expect(page.getByRole("link", { name: "Go back to Profile" })).toHaveAttribute("href", "/profile");
    await page.context().clearCookies();
    await page.goto("/prayer/new", { waitUntil: "domcontentloaded", timeout: 45_000 });
    await expect(page).toHaveURL(/\/signin(?:\?.*)?$/, { timeout: 45_000 });
  });

  test("return controls fit mobile widths without horizontal overflow", async ({ page }) => {
    await signIn(page, member);
    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const path of ["/prayer/new", "/community/new", "/community/topics/depression/posts/new", "/groups/new", "/messages/new"]) {
        await page.goto(path);
        await expectNoHorizontalOverflow(page);
      }
    }
  });
});

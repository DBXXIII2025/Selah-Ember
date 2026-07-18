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

test.skip(!url || !anonKey || !serviceKey, "Supabase environment variables are required for Study Rooms fixtures.");

const admin = createClient(url || "", serviceKey || "", {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = `phase-d-${Date.now()}`;
const password = `StudyRoomsD!${Date.now()}`;
const fixtures: Array<{ userId: string; profileId: string }> = [];
const roomIds: string[] = [];
const authCookieName = url ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : "";
const testBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3100}`;
const testBaseHost = new URL(testBaseUrl).hostname;
const isSecureTestBase = new URL(testBaseUrl).protocol === "https:";

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
    .insert({ user_id: userData.user.id, display_name: `${runId} ${key}`, username: `${runId}-${key}`.replace(/[^a-z0-9-]/gi, "") })
    .select("id,user_id")
    .single();
  expect(profileError).toBeNull();
  if (!profile) throw new Error("Fixture profile was not created.");
  fixtures.push({ userId: userData.user.id, profileId: profile.id });
  return { email, userId: userData.user.id, profileId: profile.id };
}

async function createRoom(name: string, ownerProfileId: string, visibility = "public") {
  const { data: roomId, error } = await admin.rpc("create_study_room_with_owner", {
    room_name: `${runId} ${name}`,
    room_description: "Disposable Phase D Study Room.",
    room_cover_image_url: null,
    room_study_topic: "Romans",
    room_primary_bible_book: "Romans",
    room_current_scripture_reference: "Romans 8",
    room_pinned_scripture_reference: "Romans 8:28",
    room_visibility: visibility,
    room_membership_mode: "open_join",
    owner_profile_id: ownerProfileId,
  });
  expect(error).toBeNull();
  roomIds.push(roomId);
  return roomId as string;
}

async function signIn(page: Page, email: string) {
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

test.describe.serial("Study Rooms Phase D participation", () => {
  test.describe.configure({ timeout: 120_000 });
  let owner: Awaited<ReturnType<typeof createUser>>;
  let moderator: Awaited<ReturnType<typeof createUser>>;
  let member: Awaited<ReturnType<typeof createUser>>;
  let other: Awaited<ReturnType<typeof createUser>>;
  let invitee: Awaited<ReturnType<typeof createUser>>;
  let roomId: string;
  let privateRoomId: string;
  let archivedRoomId: string;
  let studyId: string;

  test.beforeAll(async () => {
    owner = await createUser("owner");
    moderator = await createUser("moderator");
    member = await createUser("member");
    other = await createUser("other");
    invitee = await createUser("invitee");
    roomId = await createRoom("Participation", owner.profileId);
    privateRoomId = await createRoom("Private", owner.profileId, "private");
    archivedRoomId = await createRoom("Archived", owner.profileId);
    await admin.from("study_room_members").insert([
      { room_id: roomId, profile_id: moderator.profileId, role: "moderator" },
      { room_id: roomId, profile_id: member.profileId, role: "member" },
      { room_id: roomId, profile_id: other.profileId, role: "member" },
      { room_id: privateRoomId, profile_id: member.profileId, role: "member" },
      { room_id: archivedRoomId, profile_id: member.profileId, role: "member" },
    ]);
    const { data: study, error: studyError } = await admin
      .from("study_room_studies")
      .insert({ room_id: roomId, title: `${runId} Study`, study_number: 1, status: "active", created_by_profile_id: owner.profileId })
      .select("id")
      .single();
    expect(studyError).toBeNull();
    studyId = study!.id;
    await admin.from("study_rooms").update({ status: "archived" }).eq("id", archivedRoomId);
    await admin.from("study_room_notes").insert({ room_id: roomId, author_user_id: null, title: `${runId} Deleted Author Note`, body: "Retained note." });
  });

  test.afterAll(async () => {
    if (roomIds.length > 0) await admin.from("study_rooms").delete().in("id", roomIds);
    for (const fixture of fixtures) {
      await admin.from("profiles").delete().eq("id", fixture.profileId);
      await admin.auth.admin.deleteUser(fixture.userId);
    }
  });

  test("shared notes support scope, edit, private bookmarks, reports, and archived read-only", async ({ page }, testInfo) => {
    await signIn(page, member.email);
    await page.goto(`/study-rooms/${roomId}?section=notes`);
    await page.getByRole("textbox", { name: "Title" }).fill(`${runId} Room Note`);
    await page.getByRole("textbox", { name: "Body" }).fill("Room-level note body.");
    await page.getByRole("button", { name: "Create Note" }).click();
    await expect(page.getByText("Note saved.")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(`${runId} Room Note`)).toBeVisible();
    await page.locator('select[name="study_id"]:visible').last().selectOption(studyId);
    await page.locator('input[name="title"]:visible').last().fill(`${runId} Study Note`);
    await page.locator('textarea[name="body"]:visible').last().fill("Study-specific note body.");
    await page.getByRole("button", { name: "Create Note" }).click();
    await expect(page.getByText("Note saved.")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(`${runId} Study Note`)).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("Study Note 1")).toBeVisible();
    await page.getByText("Edit note").first().click();
    await page.getByRole("textbox", { name: "Title" }).first().fill(`${runId} Room Note Edited`);
    await page.getByRole("button", { name: "Save Note" }).first().click();
    await expect(page.getByText("Note updated.")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(`${runId} Deleted Author Note`)).toBeVisible();
    await expect(page.getByText("Deleted user")).toBeVisible();
    await page.getByRole("button", { name: "Save" }).first().click();
    await expect(page.getByText("Saved privately.")).toBeVisible({ timeout: 45_000 });
    await page.goto(`/study-rooms/${roomId}?section=notes&saved=1`);
    await expect(page.getByText(`${runId} Room Note Edited`)).toBeVisible();

    await signIn(page, other.email);
    await page.goto(`/study-rooms/${roomId}?section=notes&saved=1`);
    await expect(page.getByText(`${runId} Room Note Edited`)).toHaveCount(0);
    await page.goto(`/study-rooms/${roomId}?section=notes`);
    await expect(page.getByText("Edit note")).toHaveCount(0);
    await page.getByText("Report").first().click();
    await page.getByRole("textbox", { name: "Reason" }).fill("Needs review");
    await page.getByRole("button", { name: "Submit report" }).click();
    await expect(page.getByText("Report submitted.")).toBeVisible({ timeout: 45_000 });

    await signIn(page, moderator.email);
    await page.goto(`/study-rooms/${roomId}?section=notes`);
    await expect(page.getByText("Edit note").first()).toBeVisible();

    await signIn(page, member.email);
    await page.goto(`/study-rooms/${archivedRoomId}?section=notes`);
    await expect(page.getByText("This Study Room is archived and read-only.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Note" })).toHaveCount(0);

    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(`/study-rooms/${roomId}?section=notes`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBeFalsy();
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test("discussions support replies, pin, lock, bookmarks, reports, and notifications", async ({ page }) => {
    await signIn(page, member.email);
    await page.goto(`/study-rooms/${roomId}?section=discussion`);
    await page.getByRole("textbox", { name: "Title" }).fill(`${runId} Thread`);
    await page.getByRole("textbox", { name: "Body" }).fill("Thread body.");
    await page.getByRole("button", { name: "Start Discussion" }).click();
    await expect(page.getByText("Discussion started.")).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: "Save" }).first().click();
    await expect(page.getByText("Saved privately.")).toBeVisible({ timeout: 45_000 });

    await signIn(page, other.email);
    await page.goto(`/study-rooms/${roomId}?section=discussion`);
    await page.getByRole("textbox", { name: "Reply" }).first().fill("Reply body.");
    await page.getByRole("button", { name: "Post Reply" }).first().click();
    await expect(page.getByText("Reply posted.")).toBeVisible({ timeout: 45_000 });
    await page.getByText("Report").first().click();
    await page.getByRole("textbox", { name: "Reason" }).fill("Thread report");
    await page.getByRole("button", { name: "Submit report" }).click();
    await expect(page.getByText("Report submitted.")).toBeVisible({ timeout: 45_000 });

    await signIn(page, moderator.email);
    await page.goto(`/study-rooms/${roomId}?section=discussion`);
    await page.getByText("Moderation").first().click();
    await page.getByLabel("Pinned").first().check();
    await page.getByLabel("Locked").first().check();
    await page.getByRole("button", { name: "Save moderation" }).first().click();
    await expect(page.getByText("Discussion moderation updated.")).toBeVisible({ timeout: 45_000 });
    await expect(page.locator("span").filter({ hasText: "Pinned" }).first()).toBeVisible();
    await expect(page.getByText("This discussion is locked and no longer accepts replies.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Post Reply" })).toHaveCount(0);

    const { data: notifications } = await admin
      .from("notifications")
      .select("user_id,type,href")
      .eq("user_id", member.userId)
      .eq("type", "study_room_discussion_reply");
    expect(notifications?.length).toBe(1);
    expect(notifications?.[0]?.href).toContain("section=discussion");
  });

  test("prayer and resources enforce permissions, validation, privacy, and reports", async ({ page }) => {
    await signIn(page, member.email);
    await page.goto(`/study-rooms/${roomId}?section=prayer`);
    await page.getByRole("textbox", { name: "Title" }).fill(`${runId} Prayer`);
    await page.locator('select[name="category"]:visible').selectOption("healing");
    await page.getByRole("textbox", { name: "Body" }).fill("Please pray.");
    await page.getByRole("button", { name: "Share Prayer Request" }).click();
    await expect(page.getByText("Prayer request shared.")).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: /I'm praying/ }).first().click();
    await expect(page.getByText("Prayer acknowledged.")).toBeVisible({ timeout: 45_000 });
    await page.getByText("Mark answered").first().click();
    await page.getByLabel("Answered-prayer update").fill("Answered with peace.");
    await page.getByRole("button", { name: "Mark answered" }).click();
    await expect(page.getByText("Prayer request marked answered.")).toBeVisible({ timeout: 45_000 });
    await page.getByText("Report").first().click();
    await page.getByRole("textbox", { name: "Reason" }).fill("Prayer report");
    await page.getByRole("button", { name: "Submit report" }).click();
    await expect(page.getByText("Report submitted.")).toBeVisible({ timeout: 45_000 });

    await signIn(page, other.email);
    await page.goto(`/study-rooms/${privateRoomId}?section=prayer`);
    await expect(page).toHaveURL(/\/study-rooms\?message=Study(?:%20|\+)room(?:%20|\+)unavailable\.$/);

    await signIn(page, owner.email);
    await page.goto(`/study-rooms/${roomId}?section=resources`);
    await page.getByRole("textbox", { name: "Title" }).fill(`${runId} Resource`);
    await page.getByLabel("External URL").fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Add Resource" }).click();
    await expect(page.getByText("Resource URL must use HTTP or HTTPS.")).toBeVisible({ timeout: 45_000 });
    await page.getByRole("textbox", { name: "Title" }).fill(`${runId} Resource`);
    await page.getByLabel("External URL").fill("https://example.com/study");
    await page.getByRole("button", { name: "Add Resource" }).click();
    await expect(page.getByText("Resource added.")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("link", { name: "Open external resource" })).toHaveAttribute("rel", /noopener/);

    await signIn(page, member.email);
    await page.goto(`/study-rooms/${roomId}?section=resources`);
    await expect(page.getByRole("button", { name: "Add Resource" })).toHaveCount(0);
  });

  test("invitation discovery is limited and excludes members and pending invitees", async ({ page }) => {
    await signIn(page, owner.email);
    await page.goto(`/study-rooms/${roomId}?section=members&invite_q=${runId}-invitee`);
    await expect(page.getByText(`${runId} invitee`)).toBeVisible();
    await expect(page.getByText(invitee.email)).toHaveCount(0);
    await page.getByRole("button", { name: "Invite" }).first().click();
    await expect(page.getByText("Invitation sent.")).toBeVisible({ timeout: 45_000 });
    await page.goto(`/study-rooms/${roomId}?section=members&invite_q=${runId}-invitee`);
    await expect(page.getByText("No eligible profiles found.")).toBeVisible();

    await signIn(page, member.email);
    await page.goto(`/study-rooms/${roomId}?section=members&invite_q=${runId}-other`);
    await expect(page.getByText("Invitations")).toHaveCount(0);
  });
});

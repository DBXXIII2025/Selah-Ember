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

test.skip(!url || !anonKey || !serviceKey, "Supabase environment variables are required for Study Rooms Phase E fixtures.");

const admin = createClient(url || "", serviceKey || "", {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = `phase-e-${Date.now()}`;
const password = `StudyRoomsE!${Date.now()}`;
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
  fixtures.push({ userId: userData.user.id, profileId: profile.id });
  return { email, userId: userData.user.id, profileId: profile.id };
}

async function createRoom(name: string, ownerProfileId: string) {
  const { data: roomId, error } = await admin.rpc("create_study_room_with_owner", {
    room_name: `${runId} ${name}`,
    room_description: "Disposable Phase E Study Room.",
    room_cover_image_url: null,
    room_study_topic: "Romans",
    room_primary_bible_book: "Romans",
    room_current_scripture_reference: "Romans 8",
    room_pinned_scripture_reference: "Romans 8:28",
    room_visibility: "private",
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

test.describe.serial("Study Rooms Phase E moderation", () => {
  test.describe.configure({ timeout: 120_000 });
  let platform: Awaited<ReturnType<typeof createUser>>;
  let owner: Awaited<ReturnType<typeof createUser>>;
  let moderator: Awaited<ReturnType<typeof createUser>>;
  let member: Awaited<ReturnType<typeof createUser>>;
  let reporter: Awaited<ReturnType<typeof createUser>>;
  let roomId: string;
  let noteId: string;
  let threadId: string;
  let replyId: string;
  let noteReportId: string;
  let threadReportId: string;

  test.beforeAll(async () => {
    platform = await createUser("platform", "platform_engineer");
    owner = await createUser("owner");
    moderator = await createUser("moderator");
    member = await createUser("member");
    reporter = await createUser("reporter");
    roomId = await createRoom("Moderation", owner.profileId);
    await admin.from("study_room_members").insert([
      { room_id: roomId, profile_id: moderator.profileId, role: "moderator" },
      { room_id: roomId, profile_id: member.profileId, role: "member" },
      { room_id: roomId, profile_id: reporter.profileId, role: "member" },
    ]);
    const { data: note, error: noteError } = await admin
      .from("study_room_notes")
      .insert({ room_id: roomId, author_user_id: member.userId, title: `${runId} Reported Note`, body: "Reported private note body." })
      .select("id")
      .single();
    expect(noteError).toBeNull();
    noteId = note!.id;

    const { data: thread, error: threadError } = await admin
      .from("study_room_discussion_threads")
      .insert({ room_id: roomId, author_user_id: member.userId, title: `${runId} Reported Thread`, body: "Reported private thread body." })
      .select("id")
      .single();
    expect(threadError).toBeNull();
    threadId = thread!.id;

    const { data: reply, error: replyError } = await admin
      .from("study_room_discussion_replies")
      .insert({ thread_id: threadId, author_user_id: reporter.userId, body: "Reported reply body." })
      .select("id")
      .single();
    expect(replyError).toBeNull();
    replyId = reply!.id;

    const { data: reports, error: reportError } = await admin
      .from("study_room_reports")
      .insert([
        { room_id: roomId, reporter_user_id: reporter.userId, note_id: noteId, reason: `${runId} Note reason`, details: "Platform note details." },
        { room_id: roomId, reporter_user_id: reporter.userId, thread_id: threadId, reason: `${runId} Thread reason`, details: "Platform thread details." },
      ])
      .select("id,note_id,thread_id");
    expect(reportError).toBeNull();
    noteReportId = reports!.find((report) => report.note_id)?.id;
    threadReportId = reports!.find((report) => report.thread_id)?.id;
  });

  test.afterAll(async () => {
    if (roomIds.length > 0) await admin.from("study_rooms").delete().in("id", roomIds);
    for (const fixture of fixtures) {
      await admin.from("profiles").delete().eq("id", fixture.profileId);
      await admin.auth.admin.deleteUser(fixture.userId);
    }
  });

  test("ordinary members and room moderators cannot access Platform moderation", async ({ page }) => {
    await signIn(page, member.email);
    await page.goto("/platform");
    await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
    await expect(page.getByText("Study Rooms moderation")).toHaveCount(0);

    await signIn(page, moderator.email);
    await page.goto("/platform");
    await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
    await expect(page.getByText("Study Rooms moderation")).toHaveCount(0);
  });

  test("Platform Engineer reviews, filters, locks, and removes Study Room reports", async ({ page }, testInfo) => {
    await signIn(page, platform.email);
    await page.goto(`/platform?sr_status=open&sr_target=note&sr_room=${encodeURIComponent(runId)}`);
    await expect(page.getByRole("heading", { name: "Study Rooms moderation" })).toBeVisible({ timeout: 45_000 });
    const noteReport = page.getByRole("article").filter({ hasText: `${runId} Note reason` }).first();
    await expect(noteReport).toBeVisible();
    await expect(noteReport.getByText(`${runId} Reported Note`)).toBeVisible();
    await expect(noteReport.getByText(`${runId} member`)).toBeVisible();
    await expect(noteReport.getByText(`${runId} reporter`)).toBeVisible();
    await expect(page.getByText(`${runId} Thread reason`)).toHaveCount(0);

    await page.getByRole("button", { name: "Mark reviewed" }).first().click();
    await expect(page.getByText("Study Room report reviewed.")).toBeVisible({ timeout: 45_000 });
    const { data: reviewedReport } = await admin.from("study_room_reports").select("status,reviewed_by_profile_id").eq("id", noteReportId).single();
    expect(reviewedReport?.status).toBe("reviewed");
    expect(reviewedReport?.reviewed_by_profile_id).toBe(platform.profileId);

    await page.goto(`/platform?sr_status=open&sr_target=thread&sr_room=${encodeURIComponent(runId)}`);
    await expect(page.getByText(`${runId} Thread reason`)).toBeVisible({ timeout: 45_000 });
    await page.getByLabel("Lock discussion confirmation").getByRole("textbox").fill("LOCK");
    await page.getByRole("button", { name: "Lock discussion" }).click();
    await expect(page.getByText("Study Room discussion locked.")).toBeVisible({ timeout: 45_000 });
    const [{ data: lockedThread }, { data: lockedReport }] = await Promise.all([
      admin.from("study_room_discussion_threads").select("is_locked").eq("id", threadId).single(),
      admin.from("study_room_reports").select("status,reviewed_by_profile_id").eq("id", threadReportId).single(),
    ]);
    expect(lockedThread?.is_locked).toBe(true);
    expect(lockedReport?.status).toBe("reviewed");
    expect(lockedReport?.reviewed_by_profile_id).toBe(platform.profileId);

    await page.goto(`/platform?sr_status=reviewed&sr_target=note&sr_room=${encodeURIComponent(runId)}`);
    await page.getByLabel("Remove content confirmation").getByRole("textbox").fill("REMOVE");
    await page.getByRole("button", { name: "Remove content" }).click();
    await expect(page.getByText("Reported Study Room content removed.")).toBeVisible({ timeout: 45_000 });
    const [{ data: removedNote }, { data: resolvedReport }] = await Promise.all([
      admin.from("study_room_notes").select("deleted_at").eq("id", noteId).single(),
      admin.from("study_room_reports").select("status").eq("id", noteReportId).single(),
    ]);
    expect(removedNote?.deleted_at).toBeTruthy();
    expect(resolvedReport?.status).toBe("resolved");

    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(`/platform?sr_status=all&sr_room=${encodeURIComponent(runId)}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBeFalsy();
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test("report target relationships and private content remain server-authoritative", async ({ page }) => {
    const { error: crossRoomError } = await admin
      .from("study_room_reports")
      .insert({ room_id: roomId, reporter_user_id: reporter.userId, reply_id: replyId, reason: `${runId} Reply reason` });
    expect(crossRoomError).toBeNull();

    await signIn(page, reporter.email);
    await page.goto(`/study-rooms/${roomId}?section=discussion`);
    await expect(page.getByText(`${runId} Reported Thread`)).toBeVisible();
    await expect(page.getByText("Platform thread details")).toHaveCount(0);

    await signIn(page, member.email);
    await page.goto(`/study-rooms/${roomId}?section=notes`);
    await expect(page.getByText("Platform note details")).toHaveCount(0);
  });
});

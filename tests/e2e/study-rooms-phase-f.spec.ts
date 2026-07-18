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

test.skip(!url || !anonKey || !serviceKey, "Supabase environment variables are required for Study Rooms Phase F fixtures.");

const admin = createClient(url || "", serviceKey || "", {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = `phase-f-${Date.now()}`;
const password = `StudyRoomsF!${Date.now()}`;
const fixtures: Array<{ userId: string; profileId: string; email: string }> = [];
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
  fixtures.push({ userId: userData.user.id, profileId: profile.id, email });
  return { email, userId: userData.user.id, profileId: profile.id };
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

async function countRows(table: string, column: string, value: string) {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq(column, value);
  expect(error).toBeNull();
  return count || 0;
}

test.describe.serial("Study Rooms Phase F production readiness", () => {
  test.describe.configure({ timeout: 300_000 });
  let platform: Awaited<ReturnType<typeof createUser>>;
  let owner: Awaited<ReturnType<typeof createUser>>;
  let member: Awaited<ReturnType<typeof createUser>>;
  let other: Awaited<ReturnType<typeof createUser>>;
  let roomId: string;
  let studyId: string;
  let noteId: string;
  let threadId: string;
  let prayerId: string;
  let reportId: string;

  test.afterAll(async () => {
    if (roomIds.length > 0) {
      await admin.from("study_room_moderation_audit").delete().in("room_id", roomIds);
      await admin.from("study_rooms").delete().in("id", roomIds);
    }

    for (const fixture of fixtures) {
      await admin.from("profiles").delete().eq("id", fixture.profileId);
      await admin.auth.admin.deleteUser(fixture.userId);
    }
  });

  test("production-like Study Room flow, audit rows, deletion cleanup, mobile, and accessibility", async ({ page }, testInfo) => {
    platform = await createUser("platform", "platform_engineer");
    owner = await createUser("owner");
    member = await createUser("member");
    other = await createUser("other");

    const auditProbe = await admin
      .from("study_room_moderation_audit")
      .insert({
        action: "phase_f_nullable_fk_probe",
        target_type: "room",
        target_id: null,
        room_id: null,
        report_id: null,
        actor_profile_id: null,
        note: "schema-probe",
      })
      .select("id,room_id,report_id,actor_profile_id,note")
      .single();
    expect(auditProbe.error).toBeNull();
    expect(auditProbe.data?.room_id).toBeNull();
    expect(auditProbe.data?.report_id).toBeNull();
    expect(auditProbe.data?.actor_profile_id).toBeNull();
    await admin.from("study_room_moderation_audit").delete().eq("id", auditProbe.data!.id);

    await signIn(page, owner.email);
    await page.goto("/study-rooms/new");
    await page.getByLabel("Room name").fill(`${runId} Production Smoke Room`);
    await page.getByLabel("Description").fill("A disposable Study Room for Phase F readiness verification.");
    await page.getByRole("button", { name: "Create Study Room" }).click();
    await page.waitForURL(/\/study-rooms\/[0-9a-f-]+/i, { timeout: 45_000 });
    roomId = page.url().match(/study-rooms\/([0-9a-f-]+)/i)?.[1] || "";
    expect(roomId).toMatch(/^[0-9a-f-]{36}$/);
    roomIds.push(roomId);

    await signIn(page, member.email);
    await page.goto(`/study-rooms/${roomId}`);
    await page.getByRole("button", { name: "Join Study Room" }).click();
    await expect(page.getByText("You joined this Study Room.")).toBeVisible({ timeout: 45_000 });
    await admin.from("study_room_members").insert({ room_id: roomId, profile_id: other.profileId, role: "member" });

    const { data: study, error: studyError } = await admin
      .from("study_room_studies")
      .insert({ room_id: roomId, title: `${runId} Study`, study_number: 1, status: "active", scripture_reference: "Romans 8:28", created_by_profile_id: owner.profileId })
      .select("id")
      .single();
    expect(studyError).toBeNull();
    studyId = study!.id;

    const progressResult = await admin.from("study_room_study_progress").upsert(
      { study_id: studyId, profile_id: member.profileId, status: "completed", completed_at: new Date().toISOString() },
      { onConflict: "study_id,profile_id" },
    );
    expect(progressResult.error).toBeNull();
    await signIn(page, member.email);
    await page.goto(`/study-rooms/${roomId}?section=studies`);
    await expect(page.getByText("Your progress: completed")).toBeVisible({ timeout: 45_000 });

    await page.goto(`/study-rooms/${roomId}?section=notes`);
    await page.getByLabel("Title").last().fill(`${runId} Note`);
    await page.getByLabel("Body").last().fill("Phase F note body.");
    await page.getByRole("button", { name: "Create Note" }).click();
    await expect(page.getByText("Note saved.")).toBeVisible({ timeout: 45_000 });
    const { data: note } = await admin.from("study_room_notes").select("id").eq("room_id", roomId).eq("title", `${runId} Note`).single();
    noteId = note!.id;
    await page.getByRole("button", { name: "Save" }).first().click();
    await expect(page.getByText("Saved privately.")).toBeVisible({ timeout: 45_000 });

    await page.goto(`/study-rooms/${roomId}?section=discussion`);
    await page.getByLabel("Title").last().fill(`${runId} Thread`);
    await page.getByLabel("Body").last().fill("Phase F discussion body.");
    await page.getByRole("button", { name: "Start Discussion" }).click();
    await expect(page.getByText("Discussion started.")).toBeVisible({ timeout: 45_000 });
    const { data: thread } = await admin.from("study_room_discussion_threads").select("id").eq("room_id", roomId).eq("title", `${runId} Thread`).single();
    threadId = thread!.id;
    await page.getByRole("button", { name: "Save" }).first().click();
    await expect(page.getByText("Saved privately.")).toBeVisible({ timeout: 45_000 });

    await signIn(page, other.email);
    await page.goto(`/study-rooms/${roomId}?section=discussion`);
    await page.getByLabel("Reply").first().fill("Phase F reply.");
    await page.getByRole("button", { name: "Post Reply" }).first().click();
    await expect(page.getByText("Reply posted.")).toBeVisible({ timeout: 45_000 });

    await signIn(page, member.email);
    await page.goto(`/study-rooms/${roomId}?section=prayer`);
    await page.getByLabel("Title").last().fill(`${runId} Prayer`);
    await page.getByLabel("Body").last().fill("Phase F prayer body.");
    await page.getByRole("button", { name: "Share Prayer Request" }).click();
    await expect(page.getByText("Prayer request shared.")).toBeVisible({ timeout: 45_000 });
    const { data: prayer } = await admin.from("study_room_prayer_requests").select("id").eq("room_id", roomId).eq("title", `${runId} Prayer`).single();
    prayerId = prayer!.id;
    await page.getByRole("button", { name: /I'm praying/ }).first().click();
    await expect(page.getByText("Prayer acknowledged.")).toBeVisible({ timeout: 45_000 });

    await signIn(page, owner.email);
    await page.goto(`/study-rooms/${roomId}?section=resources`);
    await page.getByLabel("Title").last().fill(`${runId} Resource`);
    await page.getByLabel("External URL").last().fill("https://example.com/study-room-phase-f");
    await page.getByRole("button", { name: "Add Resource" }).click();
    await expect(page.getByText("Resource added.")).toBeVisible({ timeout: 45_000 });

    await signIn(page, member.email);
    await page.goto(`/study-rooms/${roomId}?section=notes`);
    await page.getByText("Report").first().click();
    await page.getByLabel("Reason").fill(`${runId} Report reason`);
    await page.getByRole("button", { name: "Submit report" }).click();
    await expect(page.getByText("Report submitted.")).toBeVisible({ timeout: 45_000 });
    const reportResult = await admin.from("study_room_reports").select("id").eq("room_id", roomId).eq("note_id", noteId).single();
    expect(reportResult.error).toBeNull();
    reportId = reportResult.data!.id;

    await signIn(page, platform.email);
    await page.goto(`/platform?sr_status=open&sr_target=note&sr_room=${encodeURIComponent(runId)}`);
    await expect(page.getByText(`${runId} Report reason`)).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: "Resolve" }).first().click({ force: true });
    await expect(page.getByText("Study Room report resolved.")).toBeVisible({ timeout: 45_000 });
    await page.goto(`/platform?sr_status=resolved&sr_target=note&sr_room=${encodeURIComponent(runId)}`);
    await page.getByLabel("Remove content confirmation").getByRole("textbox").fill("REMOVE");
    await page.getByRole("button", { name: "Remove content" }).click();
    await expect(page.getByText("Reported Study Room content removed.")).toBeVisible({ timeout: 45_000 });

    await page.goto(`/platform?sr_status=all&sr_room=${encodeURIComponent(runId)}`);
    await page.getByLabel("Archive room confirmation").getByRole("textbox").first().fill("ARCHIVE");
    await page.getByRole("button", { name: "Archive room" }).first().click();
    await expect(page.getByText("Study Room archived.")).toBeVisible({ timeout: 45_000 });

    const { data: auditRows, error: auditError } = await admin
      .from("study_room_moderation_audit")
      .select("action,target_type,target_id,note,actor_profile_id,report_id")
      .eq("room_id", roomId);
    expect(auditError).toBeNull();
    const auditActions = new Set((auditRows || []).map((row) => row.action));
    expect(auditActions.has("platform_report_resolved")).toBeTruthy();
    expect(auditActions.has("platform_report_content_removed")).toBeTruthy();
    expect(auditActions.has("platform_report_room_archived")).toBeTruthy();
    expect(JSON.stringify(auditRows)).not.toContain("Phase F prayer body");
    expect(JSON.stringify(auditRows)).not.toContain("Phase F note body");
    expect(JSON.stringify(auditRows)).not.toContain("Report reason");
    expect(JSON.stringify(auditRows)).not.toContain("@example.invalid");

    await signIn(page, member.email);
    await page.goto(`/study-rooms/${roomId}?section=notes`);
    await expect(page.getByText("This Study Room is archived and read-only.")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("button", { name: "Create Note" })).toHaveCount(0);

    await page.setViewportSize({ width: 320, height: 780 });
    await page.goto("/study-rooms");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBeFalsy();
    await expectNoAccessibilityViolations(page, testInfo);
    for (const width of [360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: width < 700 ? 780 : 900 });
      await page.goto(`/study-rooms/${roomId}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBeFalsy();
    }

    const deletion = await admin.rpc("delete_user_account_data", { target_user_id: member.userId });
    expect(deletion.error).toBeNull();
    const [{ data: scrubbedNote }, { count: bookmarkCount }, { count: supportCount }, { count: memberReportCount }] = await Promise.all([
      admin.from("study_room_notes").select("author_user_id").eq("id", noteId).single(),
      admin.from("study_room_bookmarks").select("id", { count: "exact", head: true }).eq("profile_id", member.profileId),
      admin.from("study_room_prayer_support").select("id", { count: "exact", head: true }).eq("profile_id", member.profileId),
      admin.from("study_room_reports").select("id", { count: "exact", head: true }).eq("reporter_user_id", member.userId),
    ]);
    expect(scrubbedNote?.author_user_id).toBeNull();
    expect(bookmarkCount || 0).toBe(0);
    expect(supportCount || 0).toBe(0);
    expect(memberReportCount || 0).toBe(0);

    await admin.from("study_room_moderation_audit").delete().eq("room_id", roomId);
    await admin.from("study_rooms").delete().eq("id", roomId);
    roomIds.splice(roomIds.indexOf(roomId), 1);

    await expect.poll(() => countRows("study_rooms", "id", roomId)).toBe(0);
    await expect.poll(() => countRows("study_room_reports", "room_id", roomId)).toBe(0);
    await expect.poll(() => countRows("study_room_invitations", "room_id", roomId)).toBe(0);
    await expect.poll(() => countRows("study_room_join_requests", "room_id", roomId)).toBe(0);
    await expect.poll(() => countRows("study_room_notes", "room_id", roomId)).toBe(0);
    await expect.poll(() => countRows("study_room_discussion_threads", "room_id", roomId)).toBe(0);
    await expect.poll(() => countRows("study_room_prayer_requests", "room_id", roomId)).toBe(0);
    await expect.poll(() => countRows("study_room_resources", "room_id", roomId)).toBe(0);

    expect(studyId).toMatch(/^[0-9a-f-]{36}$/);
    expect(threadId).toMatch(/^[0-9a-f-]{36}$/);
    expect(prayerId).toMatch(/^[0-9a-f-]{36}$/);
    expect(reportId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

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
const runId = `phase-c-${Date.now()}`;
const password = `StudyRooms!${Date.now()}`;
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

  if (encodedLength <= maxChunkSize) {
    return [{ name: key, value }];
  }

  const chunks: string[] = [];
  let encodedValue = encodeURIComponent(value);

  while (encodedValue.length > 0) {
    let encodedChunkHead = encodedValue.slice(0, maxChunkSize);
    const lastEscapePos = encodedChunkHead.lastIndexOf("%");

    if (lastEscapePos > maxChunkSize - 3) {
      encodedChunkHead = encodedChunkHead.slice(0, lastEscapePos);
    }

    let valueHead = "";

    while (encodedChunkHead.length > 0) {
      try {
        valueHead = decodeURIComponent(encodedChunkHead);
        break;
      } catch (error) {
        if (
          error instanceof URIError &&
          encodedChunkHead.at(-3) === "%" &&
          encodedChunkHead.length > 3
        ) {
          encodedChunkHead = encodedChunkHead.slice(0, encodedChunkHead.length - 3);
        } else {
          throw error;
        }
      }
    }

    chunks.push(valueHead);
    encodedValue = encodedValue.slice(encodedChunkHead.length);
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
  if (!userData.user) {
    throw new Error("Fixture auth user was not created.");
  }
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .insert({ user_id: userData.user.id, display_name: `${runId} ${key}` })
    .select("id,user_id")
    .single();
  expect(profileError).toBeNull();
  if (!profile) {
    throw new Error("Fixture profile was not created.");
  }
  fixtures.push({ userId: userData.user.id, profileId: profile.id });
  return { email, userId: userData.user.id, profileId: profile.id };
}

async function createRoom(name: string, ownerProfileId: string, visibility = "public", membershipMode = "open_join") {
  const { data: roomId, error } = await admin.rpc("create_study_room_with_owner", {
    room_name: `${runId} ${name}`,
    room_description: "Disposable Phase C Study Room.",
    room_cover_image_url: null,
    room_study_topic: "Romans",
    room_primary_bible_book: "Romans",
    room_current_scripture_reference: "Romans 8",
    room_pinned_scripture_reference: "Romans 8:28",
    room_visibility: visibility,
    room_membership_mode: membershipMode,
    owner_profile_id: ownerProfileId,
  });
  expect(error).toBeNull();
  roomIds.push(roomId);
  return roomId as string;
}

async function expectNoAccessibilityViolations(page: Page, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  await testInfo.attach("axe-violations", {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });

  expect(results.violations).toEqual([]);
}

async function signIn(page: Page, email: string) {
  if (!url || !anonKey || !authCookieName) {
    throw new Error("Supabase auth configuration is missing.");
  }

  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
  if (!data.session) {
    throw new Error("Fixture auth session was not created.");
  }

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

test.describe.serial("Study Rooms Phase C UI", () => {
  test.describe.configure({ timeout: 150_000 });
  let owner: Awaited<ReturnType<typeof createUser>>;
  let member: Awaited<ReturnType<typeof createUser>>;
  let nonmember: Awaited<ReturnType<typeof createUser>>;
  let publicRoomId: string;
  let requestRoomId: string;
  let inviteRoomId: string;
  let archivedRoomId: string;

  test.beforeAll(async () => {
    owner = await createUser("owner");
    member = await createUser("member");
    nonmember = await createUser("nonmember");
    publicRoomId = await createRoom("Public Open", owner.profileId, "public", "open_join");
    requestRoomId = await createRoom("Public Request", owner.profileId, "public", "request_to_join");
    inviteRoomId = await createRoom("Unlisted Invite", owner.profileId, "unlisted", "invite_only");
    archivedRoomId = await createRoom("Archived Room", owner.profileId, "public", "open_join");
    await createRoom("Private Invite", owner.profileId, "private", "invite_only");
    await admin.from("study_room_members").insert({ room_id: publicRoomId, profile_id: member.profileId, role: "member" });
    await admin.from("study_room_members").insert({ room_id: archivedRoomId, profile_id: member.profileId, role: "member" });
    await admin.from("study_room_studies").insert({
      room_id: publicRoomId,
      title: `${runId} Owner Controls Study`,
      scripture_reference: "Romans 8:28",
      study_number: 1,
      status: "active",
      created_by_profile_id: owner.profileId,
    });
    await admin.from("study_room_studies").insert({
      room_id: archivedRoomId,
      title: `${runId} Archived Study`,
      scripture_reference: "Romans 12",
      study_number: 1,
      status: "active",
      created_by_profile_id: owner.profileId,
    });
    await admin.from("study_rooms").update({ status: "archived" }).eq("id", archivedRoomId);
    await admin.from("study_room_notes").insert({
      room_id: publicRoomId,
      author_user_id: null,
      title: "Anonymized note",
      body: "Retained context.",
    });
  });

  test.afterAll(async () => {
    if (roomIds.length > 0) {
      await admin.from("study_rooms").delete().in("id", roomIds);
    }
    for (const fixture of fixtures) {
      await admin.from("profiles").delete().eq("id", fixture.profileId);
      await admin.auth.admin.deleteUser(fixture.userId);
    }
  });

  test("signed-out users are guarded and public navigation excludes Study Rooms", async ({ page }) => {
    await page.goto("/study-rooms");
    await expect(page).toHaveURL(/\/signin(?:\?.*)?$/, { timeout: 45_000 });
    await page.goto("/community");
    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Study Rooms" })).toHaveCount(0);
  });

  test("authenticated navigation appears and listing respects discovery visibility", async ({ page }, testInfo) => {
    await signIn(page, nonmember.email);
    await page.goto("/study-rooms");
    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Study Rooms" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Study Rooms" })).toBeVisible();
    await expect(page.getByText(`${runId} Public Open`)).toBeVisible();
    await expect(page.getByText(`${runId} Private Invite`)).toHaveCount(0);
    await expect(page.getByText(`${runId} Unlisted Invite`)).toHaveCount(0);
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test("creation form validates required fields and redirects after successful creation", async ({ page }) => {
    await signIn(page, owner.email);
    await page.goto("/study-rooms/new");
    await page.getByRole("button", { name: "Create Study Room" }).click();
    await expect(page.getByLabel("Room name")).toBeFocused();
    await page.getByLabel("Room name").fill(`${runId} UI Created`);
    await page.getByLabel("Description").fill("Created through the Phase C form.");
    await page.getByLabel("Study topic").fill("Gospel of John");
    await page.getByRole("button", { name: "Create Study Room" }).click();
    await expect(page).toHaveURL(/\/study-rooms\/[0-9a-f-]+$/, { timeout: 45_000 });
    const createdRoomId = new URL(page.url()).pathname.split("/").at(-1);
    if (createdRoomId) roomIds.push(createdRoomId);
    await expect(page.getByRole("heading", { level: 1, name: `${runId} UI Created` })).toBeVisible();
  });

  test("room join states, null authors, and role controls render correctly", async ({ page }) => {
    await signIn(page, nonmember.email);
    await page.goto(`/study-rooms/${publicRoomId}`);
    await expect(page.getByRole("button", { name: "Join Study Room" })).toBeVisible();
    await expect(page.getByText("Anonymized note - Deleted user")).toBeVisible();
    await page.goto(`/study-rooms/${requestRoomId}`);
    await expect(page.getByRole("button", { name: "Request to Join" })).toBeVisible();
    await page.goto(`/study-rooms/${inviteRoomId}`);
    await expect(page.getByText("This Study Room is invite only.")).toBeVisible();

    await signIn(page, member.email);
    await page.goto(`/study-rooms/${publicRoomId}?section=studies`);
    await expect(page.getByRole("heading", { name: "Create Study" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add Study" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
    await page.goto(`/study-rooms/${publicRoomId}?section=settings`);
    await expect(page.getByRole("heading", { name: "Settings" })).toHaveCount(0);
    await expect(page.getByText("Pinned Scripture")).toBeVisible();

    await signIn(page, owner.email);
    await page.goto(`/study-rooms/${publicRoomId}?section=studies`);
    await expect(page.getByRole("heading", { name: "Create Study" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Study" })).toBeVisible();
    await page.goto(`/study-rooms/${publicRoomId}?section=members`);
    await expect(page.getByText("Ownership or removal")).toBeVisible();
  });

  test("archived rooms render read-only for members and owners", async ({ page }) => {
    await signIn(page, member.email);
    await page.goto(`/study-rooms/${archivedRoomId}?section=studies`);
    await expect(page.getByText("This Study Room is archived and read-only.")).toBeVisible();
    await expect(page.getByText(`${runId} Archived Study`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Update" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Create Study" })).toHaveCount(0);

    await signIn(page, owner.email);
    await page.goto(`/study-rooms/${archivedRoomId}?section=members`);
    await expect(page.getByText("This Study Room is archived and read-only.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Update role" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Invite" })).toHaveCount(0);
  });

  test("mobile layout has no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await signIn(page, owner.email);
    await page.goto(`/study-rooms/${publicRoomId}`);
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasOverflow).toBeFalsy();
  });
});

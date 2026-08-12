import { expect, test } from "@playwright/test";
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

test.skip(!url || !anonKey || !serviceKey, "Supabase environment variables are required for auth fixtures.");

const admin = createClient(url || "", serviceKey || "", {
  auth: { autoRefreshToken: false, persistSession: false },
});
const authClient = createClient(url || "", anonKey || "", {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = `auth-${Date.now()}`;
const password = `AuthFixture!${Date.now()}`;
const createdUserIds: string[] = [];

async function createAuthUser(key: string, options: { confirmed: boolean; profile?: boolean }) {
  const email = `${runId}-${key}@gmail.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: options.confirmed,
    user_metadata: { display_name: `${runId} ${key}` },
  });
  expect(error).toBeNull();
  if (!data.user) throw new Error("Fixture auth user was not created.");
  createdUserIds.push(data.user.id);

  if (options.confirmed) {
    const { error: confirmError } = await admin.auth.admin.updateUserById(data.user.id, { email_confirm: true });
    expect(confirmError).toBeNull();
    await expect.poll(async () => {
      const { data: userData, error } = await admin.auth.admin.getUserById(data.user!.id);
      expect(error).toBeNull();
      return Boolean(userData.user?.email_confirmed_at || userData.user?.confirmed_at);
    }, { timeout: 30_000 }).toBeTruthy();
    await expect.poll(async () => {
      const { data: signInData, error } = await authClient.auth.signInWithPassword({ email, password });
      if (signInData.session) await authClient.auth.signOut();
      return error?.code || (signInData.session ? "signed_in" : "missing_session");
    }, { timeout: 60_000 }).toBe("signed_in");
  }

  if (options.profile !== false) {
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        user_id: data.user.id,
        display_name: `${runId} ${key}`,
        username: `${runId}-${key}`.replace(/[^a-z0-9-]/gi, ""),
      },
      { onConflict: "user_id" },
    );
    expect(profileError).toBeNull();
  }

  return { email, userId: data.user.id };
}

test.describe.serial("authentication correctness", () => {
  test.describe.configure({ timeout: 180_000 });

  test.afterAll(async () => {
    for (const userId of createdUserIds) {
      await admin.from("user_bans").delete().eq("banned_user_id", userId);
      await admin.from("profiles").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });

  test("unverified users get verification messaging and cannot enter protected app", async ({ page }) => {
    const user = await createAuthUser("unverified", { confirmed: false });

    await page.goto("/signin");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("textbox", { name: "Password" }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/signin\?message=/);
    await expect(page.getByText("Please confirm your email before signing in.")).toBeVisible();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/signin(?:\?.*)?$/);
  });

  test("verified users sign in, persist session, and are not classified as unverified", async ({ page }) => {
    const user = await createAuthUser("verified", { confirmed: true });

    await page.goto("/signin");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("textbox", { name: "Password" }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/community$/, { timeout: 90_000 });
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByText("Please confirm your email before signing in.")).toHaveCount(0);

    await page.reload();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Selah Ember is ready/ })).toBeVisible();
    await expect(page).not.toHaveURL(/\/signin/);
  });

  test("invalid credentials do not show verification messaging", async ({ page }) => {
    const user = await createAuthUser("invalid-password", { confirmed: true });

    await page.goto("/signin");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("textbox", { name: "Password" }).fill("WrongPassword!123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/signin\?message=/);
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
    await expect(page.getByText("Please confirm your email before signing in.")).toHaveCount(0);
  });

  test("verified users with missing profile are repaired without verification messaging", async ({ page }) => {
    const user = await createAuthUser("missing-profile", { confirmed: true, profile: false });

    await page.goto("/signin");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("textbox", { name: "Password" }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/community$/, { timeout: 90_000 });
    await expect(page.getByText("Please confirm your email before signing in.")).toHaveCount(0);

    const { data: profile, error } = await admin
      .from("profiles")
      .select("id,user_id")
      .eq("user_id", user.userId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(profile?.user_id).toBe(user.userId);
  });

  test("duplicate signup for an existing verified email does not fake account creation", async ({ page }) => {
    const user = await createAuthUser("duplicate", { confirmed: true });

    await page.goto("/signup");
    await page.getByLabel("Display name").fill(`${runId} duplicate new`);
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("textbox", { name: "Password" }).fill("DifferentPassword!123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/signin\?message=/);
    await expect(page.getByText("If you already have an account, sign in with your existing password.")).toBeVisible();

    const { data, error } = await authClient.auth.signInWithPassword({
      email: user.email,
      password: "DifferentPassword!123",
    });
    expect(error?.code).toBe("invalid_credentials");
    expect(data.session).toBeNull();
  });
});

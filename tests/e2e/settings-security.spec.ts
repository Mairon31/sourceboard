import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hashOpaqueToken } from "../../worker/auth/crypto";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../worker/auth/security";
import { waitForUiReady } from "./test-helpers";

const USER_ID = "e2e-settings-security-user";
const USERNAME = "e2e-settings-security";
const CURRENT_SESSION_ID = "e2e-settings-current";
const OTHER_SESSION_ID = "e2e-settings-other";
const CURRENT_TOKEN = "sourceboard-e2e-settings-current-token";
const CSRF_TOKEN = "sourceboard-e2e-settings-security-csrf";

function executeLocalSql(sql: string) {
  const wranglerEntrypoint = resolve(
    process.cwd(),
    "node_modules",
    "wrangler",
    "bin",
    "wrangler.js",
  );
  execFileSync(
    process.execPath,
    [wranglerEntrypoint, "d1", "execute", "DB", "--local", "--command", sql],
    { cwd: process.cwd(), stdio: "pipe" },
  );
}

async function installSettingsFixture(page: Page) {
  const now = Date.now();
  const currentHash = hashOpaqueToken(CURRENT_TOKEN);
  const otherHash = hashOpaqueToken("sourceboard-e2e-settings-other-token");
  const expiresAt = now + 24 * 60 * 60 * 1000;

  executeLocalSql(`
    DELETE FROM username_change_history WHERE user_id = '${USER_ID}';
    DELETE FROM sessions WHERE user_id = '${USER_ID}'
      OR id IN ('${CURRENT_SESSION_ID}', '${OTHER_SESSION_ID}')
      OR token_hash IN ('${currentHash}', '${otherHash}');
    INSERT OR IGNORE INTO users
      (id, username, username_normalized, email_lookup_hash, email_encrypted, email_key_version,
       status, email_verified_at, created_at, updated_at, last_seen_at)
    VALUES
      ('${USER_ID}', '${USERNAME}', '${USERNAME}',
       'e2e-settings-security-email-hash', 'e2e-settings-security-email', 'test-v1',
       'ACTIVE', ${now}, ${now}, ${now}, ${now});
    UPDATE users
      SET username = '${USERNAME}', username_normalized = '${USERNAME}',
          status = 'ACTIVE', email_verified_at = ${now}, updated_at = ${now}
      WHERE id = '${USER_ID}';
    INSERT OR REPLACE INTO user_profiles
      (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility,
       created_at, updated_at)
    VALUES
      ('${USER_ID}', 'Settings Security User', 'Settings security fixture', NULL, NULL,
       'PUBLIC', ${now}, ${now});
    INSERT OR REPLACE INTO user_preferences
      (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests,
       notify_activity, notify_friendships, created_at, updated_at)
    VALUES
      ('${USER_ID}', 1, 1, 0, 1, 1, 1, ${now}, ${now});
    INSERT INTO sessions
      (id, user_id, token_hash, created_at, last_used_at, expires_at, revoked_at,
       ip_prefix_hash, user_agent_hash, ip_encrypted, ip_key_version, user_agent,
       cf_city, cf_region, cf_country, context_updated_at)
    VALUES
      ('${CURRENT_SESSION_ID}', '${USER_ID}', '${currentHash}', ${now - 5000}, ${now},
       ${expiresAt}, NULL, NULL, NULL, NULL, NULL,
       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
       'San Jose', 'San Jose', 'CR', ${now}),
      ('${OTHER_SESSION_ID}', '${USER_ID}', '${otherHash}', ${now - 10000}, ${now - 2000},
       ${expiresAt}, NULL, NULL, NULL, NULL, NULL,
       'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
       'Heredia', 'Heredia', 'CR', ${now - 2000});
  `);

  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: CURRENT_TOKEN,
      url: "https://localhost:5173",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
    {
      name: CSRF_COOKIE_NAME,
      value: CSRF_TOKEN,
      url: "https://localhost:5173",
      httpOnly: false,
      secure: true,
      sameSite: "Lax",
    },
  ]);
}

test("Settings separates General from Security and preserves the current session when signing out others", async ({
  page,
}) => {
  await installSettingsFixture(page);
  await page.goto("/settings");
  await waitForUiReady(page);

  const general = page.locator('[data-settings-surface="general"]');
  const security = page.locator('[data-settings-surface="security"]');
  await expect(general).toBeVisible();
  await expect(security).toBeVisible();
  await expect(security.getByText("Username", { exact: true }).first()).toBeVisible();
  await expect(security.getByText("Password", { exact: true }).first()).toBeVisible();

  const currentSession = page
    .locator(".product-settings-session")
    .filter({ hasText: "Chrome on Windows" });
  const otherSession = page
    .locator(".product-settings-session")
    .filter({ hasText: "Safari on iOS" });

  await expect(currentSession).toBeVisible();
  await expect(currentSession.getByText("This device", { exact: true })).toBeVisible();
  await expect(otherSession).toBeVisible();
  await expect(otherSession).toContainText("Heredia");

  await currentSession.getByRole("button", { name: "Details" }).click();
  await expect(currentSession.getByText("Chrome 126.0.0.0", { exact: true })).toBeVisible();
  await expect(currentSession.getByText("Windows 10", { exact: true })).toBeVisible();
  await expect(currentSession.getByText("desktop", { exact: true })).toBeVisible();
  await expect(currentSession.getByText("San Jose, San Jose, CR", { exact: true })).toBeVisible();

  const signOutOthers = page.getByRole("button", { name: "Sign out other sessions" });
  await expect(signOutOthers).toBeEnabled();
  const deleteRequest = page.waitForRequest(
    (request) => request.url().endsWith("/api/auth/sessions") && request.method() === "DELETE",
  );
  await signOutOthers.click();
  await deleteRequest;

  await expect(page.getByRole("status")).toContainText("Other sessions signed out.");
  await expect(otherSession).toHaveCount(0);
  await expect(currentSession).toBeVisible();

  const stillAuthenticated = await page.evaluate(async () => {
    const response = await fetch("/api/auth/session");
    return (await response.json()) as { authenticated?: boolean };
  });
  expect(stillAuthenticated.authenticated).toBe(true);
});

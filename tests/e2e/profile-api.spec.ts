import { expect, test } from "@playwright/test";
import { friendsFixture, installFriendsFixture } from "./friends-fixture";

test("profile mutations require authentication even when the request is same-origin", async ({
  request,
}) => {
  const response = await request.patch("/api/profile/me", {
    headers: {
      origin: "http://localhost:5173",
      "content-type": "application/json",
    },
    data: {
      displayName: "Should not write",
      bio: "",
      profileVisibility: "PUBLIC",
      socialLinks: [],
    },
  });

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({
    error: { code: "AUTHENTICATION_REQUIRED" },
  });
});

test("profile mutations reject foreign origins before any write", async ({ request }) => {
  const response = await request.patch("/api/profile/me", {
    headers: {
      origin: "https://evil.example",
      "content-type": "application/json",
    },
    data: {
      displayName: "Should not write",
      bio: "",
      profileVisibility: "PUBLIC",
      socialLinks: [],
    },
  });

  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toMatchObject({
    error: { code: "CSRF_ORIGIN_INVALID" },
  });
});

test("friend discovery returns only eligible public accounts", async ({ page }) => {
  await installFriendsFixture(page);
  const response = await page.context().request.get("/api/friends?mode=discover&q=e2e-social");
  expect(response.status()).toBe(200);

  const body = (await response.json()) as {
    friends: Array<{ username: string; relationship: string }>;
  };
  const usernames = body.friends.map((friend) => friend.username);

  expect(usernames).toContain(friendsFixture.eligible);
  expect(usernames).not.toContain(friendsFixture.private);
  expect(usernames).not.toContain(friendsFixture.blocked);
  expect(usernames).not.toContain(friendsFixture.optOut);
  expect(usernames).not.toContain(friendsFixture.friend);
  expect(usernames).not.toContain(friendsFixture.incoming);
  expect(body.friends).toHaveLength(1);
  expect(body.friends[0]?.relationship).toBe("NONE");
  expect(JSON.stringify(body)).not.toContain("email");
});

test("friend discovery rejects oversized search terms", async ({ page }) => {
  await installFriendsFixture(page);
  const query = "a".repeat(65);
  const response = await page
    .context()
    .request.get(`/api/friends?mode=discover&q=${encodeURIComponent(query)}`);
  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    error: { code: "INVALID_FRIEND_SEARCH" },
  });
});

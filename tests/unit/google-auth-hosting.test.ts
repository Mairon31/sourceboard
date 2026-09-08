import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const firebaseClientSource = readFileSync(
  new URL("../../app/data/firebase-client.ts", import.meta.url),
  "utf8",
);
const authScreenSource = readFileSync(
  new URL("../../app/components/product/AuthScreen.tsx", import.meta.url),
  "utf8",
);

describe("Google auth hosting compatibility", () => {
  it("uses popup auth on the Cloudflare-hosted app", () => {
    expect(firebaseClientSource).toContain("signInWithPopup");
    expect(firebaseClientSource).not.toContain("signInWithRedirect");
    expect(firebaseClientSource).not.toContain("getRedirectResult");
    expect(authScreenSource).toContain("signInWithGoogle(authConfig.firebase)");
    expect(authScreenSource).toContain('postAuthJson("/api/auth/google"');
  });
});

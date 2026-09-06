import { describe, expect, it } from "vitest";
import {
  createEmailLookupHash,
  createOpaqueToken,
  decryptEmail,
  encryptEmail,
  hashOpaqueToken,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from "../../worker/auth/crypto";

const lookupKey = Buffer.alloc(32, 7).toString("base64");
const encryptionKey = Buffer.alloc(32, 9).toString("base64");

describe("authentication cryptography", () => {
  it("normalizes email before HMAC lookup and never exposes the plaintext envelope", () => {
    const normalized = normalizeEmail("  Alice@Example.COM ");
    const lookupHash = createEmailLookupHash(normalized, lookupKey);
    const encrypted = encryptEmail(normalized, encryptionKey);

    expect(normalized).toBe("alice@example.com");
    expect(lookupHash).toBe(createEmailLookupHash("alice@example.com", lookupKey));
    expect(encrypted).not.toContain(normalized);
    expect(decryptEmail(encrypted, encryptionKey)).toBe(normalized);
  });

  it("uses a per-password salt and constant-time verification", async () => {
    const first = await hashPassword("correct horse battery staple");
    const second = await hashPassword("correct horse battery staple");

    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
    await expect(verifyPassword("correct horse battery staple", first)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", first)).resolves.toBe(false);
  });

  it("creates opaque tokens with at least 256 bits of entropy and hashes only the token", () => {
    const token = createOpaqueToken();
    const tokenHash = hashOpaqueToken(token);

    expect(Buffer.from(token, "base64url").byteLength).toBe(32);
    expect(tokenHash).not.toContain(token);
  });
});

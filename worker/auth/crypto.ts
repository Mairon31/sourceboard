import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { Buffer } from "node:buffer";

const PASSWORD_VERSION = "scrypt-v1";
const EMAIL_KEY_VERSION = "v1";
const SESSION_TOKEN_BYTES = 32;

const PASSWORD_PARAMS = {
  N: 16_384,
  r: 8,
  p: 1,
  keyLength: 64,
  maxmem: 128 * 1024 * 1024,
} as const;

export interface PasswordRecord {
  hash: string;
  salt: string;
  paramsJson: string;
  version: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().normalize("NFKC").toLowerCase();
}

export function normalizeUsername(username: string): string {
  return username.trim().normalize("NFKC").toLowerCase();
}

export function createIdentifier(): string {
  return randomBytes(16).toString("hex");
}

export function createOpaqueToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

export function hashSecurityValue(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url").slice(0, 22);
}

function decodeSecret(secret: string, label: string): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(secret) || secret.length % 4 === 1) {
    throw new Error(`${label} must be base64 encoded`);
  }

  const value = Buffer.from(secret, "base64");
  if (value.length < 32) {
    throw new Error(`${label} must contain at least 32 bytes`);
  }

  return value;
}

function decodeAesSecret(secret: string): Buffer {
  const value = decodeSecret(secret, "DATA_ENCRYPTION_KEY_V1");
  if (value.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY_V1 must contain exactly 32 bytes");
  }

  return value;
}

function parsePasswordParams(paramsJson: string): {
  N: number;
  r: number;
  p: number;
  keyLength: number;
} {
  const parsed: unknown = JSON.parse(paramsJson);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid password parameters");
  }

  const params = parsed as Record<string, unknown>;
  const N = params.N;
  const r = params.r;
  const p = params.p;
  const keyLength = params.keyLength;
  const values = [N, r, p, keyLength];
  if (
    !values.every((value): value is number => typeof value === "number" && Number.isInteger(value))
  ) {
    throw new Error("Invalid password parameters");
  }

  const [integerN, integerR, integerP, integerKeyLength] = values;
  const invalidRange = [integerN < 1_024, integerR < 1, integerP < 1, integerKeyLength < 32].some(
    Boolean,
  );
  if (invalidRange) {
    throw new Error("Invalid password parameters");
  }

  return { N: integerN, r: integerR, p: integerP, keyLength: integerKeyLength };
}

async function derivePasswordKey(
  password: string,
  salt: Buffer,
  params: { N: number; r: number; p: number; keyLength: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      params.keyLength,
      {
        N: params.N,
        r: params.r,
        p: params.p,
        maxmem: PASSWORD_PARAMS.maxmem,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey as Buffer);
      },
    );
  });
}

export async function hashPassword(
  password: string,
  salt = randomBytes(16),
): Promise<PasswordRecord> {
  const hash = await derivePasswordKey(password, salt, PASSWORD_PARAMS);

  return {
    hash: hash.toString("base64"),
    salt: salt.toString("base64"),
    paramsJson: JSON.stringify({
      N: PASSWORD_PARAMS.N,
      r: PASSWORD_PARAMS.r,
      p: PASSWORD_PARAMS.p,
      keyLength: PASSWORD_PARAMS.keyLength,
    }),
    version: PASSWORD_VERSION,
  };
}

export async function verifyPassword(password: string, record: PasswordRecord): Promise<boolean> {
  if (record.version !== PASSWORD_VERSION) {
    return false;
  }

  try {
    const params = parsePasswordParams(record.paramsJson);
    const expected = Buffer.from(record.hash, "base64");
    const salt = Buffer.from(record.salt, "base64");
    const actual = await derivePasswordKey(password, salt, params);
    if (expected.length !== actual.length) {
      return false;
    }

    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function needsPasswordRehash(record: PasswordRecord): boolean {
  if (record.version !== PASSWORD_VERSION) {
    return true;
  }

  try {
    return (
      JSON.stringify(parsePasswordParams(record.paramsJson)) !==
      JSON.stringify({
        N: PASSWORD_PARAMS.N,
        r: PASSWORD_PARAMS.r,
        p: PASSWORD_PARAMS.p,
        keyLength: PASSWORD_PARAMS.keyLength,
      })
    );
  } catch {
    return true;
  }
}

export function createEmailLookupHash(normalizedEmail: string, secret: string): string {
  return createHmac("sha256", decodeSecret(secret, "EMAIL_LOOKUP_KEY_V1"))
    .update(normalizedEmail, "utf8")
    .digest("base64url");
}

function encodeBase64Url(value: Buffer): string {
  return value.toString("base64url");
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function encryptEmail(normalizedEmail: string, secret: string): string {
  const key = decodeAesSecret(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(normalizedEmail, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    EMAIL_KEY_VERSION,
    encodeBase64Url(iv),
    encodeBase64Url(tag),
    encodeBase64Url(ciphertext),
  ].join(".");
}

export function decryptEmail(encryptedEmail: string, secret: string): string {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = encryptedEmail.split(".");
  if (version !== EMAIL_KEY_VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error("Unsupported encrypted email envelope");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    decodeAesSecret(secret),
    decodeBase64Url(ivEncoded),
  );
  decipher.setAuthTag(decodeBase64Url(tagEncoded));
  return Buffer.concat([
    decipher.update(decodeBase64Url(ciphertextEncoded)),
    decipher.final(),
  ]).toString("utf8");
}

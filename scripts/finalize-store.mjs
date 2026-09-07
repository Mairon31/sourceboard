import { readFileSync, writeFileSync } from "node:fs";

const path = "worker/auth/service.ts";
let text = readFileSync(path, "utf8");
const marker = "export function createAuthService(dependencies: AuthServiceDependencies): AuthService {";

if (!text.includes("const SESSION_TOUCH_INTERVAL_MS")) {
  if (!text.includes(marker)) throw new Error("createAuthService marker missing");
  text = text.replace(marker, `const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;\n\n${marker}`);
}

const currentStart = text.indexOf("  async function currentSession(");
const currentEnd = text.indexOf("  async function prepareLogin(", currentStart);
if (currentStart < 0 || currentEnd < 0) throw new Error("currentSession block missing");
let currentBlock = text.slice(currentStart, currentEnd);

const currentLookup = `    const current = await dependencies.store.findActiveSessionByTokenHash(\n      hashOpaqueToken(rawToken),\n      now(),\n    );`;
const throttledCurrentLookup = `    const at = now();\n    const current = await dependencies.store.findActiveSessionByTokenHash(\n      hashOpaqueToken(rawToken),\n      at,\n    );`;
if (!currentBlock.includes("const at = now();")) {
  if (!currentBlock.includes(currentLookup)) throw new Error("currentSession lookup shape changed");
  currentBlock = currentBlock.replace(currentLookup, throttledCurrentLookup);
}

const currentTouch = "    await dependencies.store.touchSession(current.id, now());";
const throttledTouch = `    if (at - current.lastUsedAt >= SESSION_TOUCH_INTERVAL_MS) {\n      await dependencies.store.touchSession(current.id, at);\n    }`;
if (!currentBlock.includes("SESSION_TOUCH_INTERVAL_MS")) {
  if (!currentBlock.includes(currentTouch)) throw new Error("currentSession touch shape changed");
  currentBlock = currentBlock.replace(currentTouch, throttledTouch);
}
text = text.slice(0, currentStart) + currentBlock + text.slice(currentEnd);

const getStart = text.indexOf("  async function getSession(");
const getEnd = text.indexOf("  async function logout(", getStart);
if (getStart < 0 || getEnd < 0) throw new Error("getSession block missing");
let getBlock = text.slice(getStart, getEnd);
const getTouch = "    await dependencies.store.touchSession(current.id, at);";
if (!getBlock.includes("SESSION_TOUCH_INTERVAL_MS")) {
  if (!getBlock.includes(getTouch)) throw new Error("getSession touch shape changed");
  getBlock = getBlock.replace(getTouch, throttledTouch);
}
text = text.slice(0, getStart) + getBlock + text.slice(getEnd);

const matches = text.match(/at - current\.lastUsedAt >= SESSION_TOUCH_INTERVAL_MS/g) ?? [];
if (matches.length !== 2) throw new Error(`expected 2 throttled session paths, found ${matches.length}`);

writeFileSync(path, text);

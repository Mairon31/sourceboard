/* global URL, console, process */

import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseURL = process.env.PERF_BASE_URL ?? "https://srcboard.me";
const outputDir = process.env.PERF_OUTPUT_DIR ?? "test-results/performance";
const homePath = "/es";
const viewport = {
  width: Number(process.env.PERF_VIEWPORT_WIDTH ?? 1440),
  height: Number(process.env.PERF_VIEWPORT_HEIGHT ?? 1000),
};

function now() {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

function routeName(url) {
  return new URL(url).pathname.replace(/^\/(?:en|es|pt|fr|ru|de)(?=\/|$)/, "") || "/";
}

async function waitUntilUsable(page, expectedPath) {
  await page.waitForURL(
    (url) => {
      const actualPath = routeName(url.href);
      return expectedPath.endsWith("/")
        ? actualPath.startsWith(expectedPath)
        : actualPath === expectedPath;
    },
    { timeout: 15_000 },
  );
  await page.locator("h1, h2, [role='heading']").first().waitFor({
    state: "visible",
    timeout: 15_000,
  });
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
  });
  const page = await context.newPage();
  const requests = new Map();
  const finished = [];
  const documents = [];

  page.on("request", (request) => {
    const record = {
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      startedAt: now(),
    };
    requests.set(request, record);
    if (request.resourceType() === "document") documents.push(record);
  });
  page.on("requestfinished", async (request) => {
    const record = requests.get(request);
    if (!record) return;
    record.finishedAt = now();
    const response = await request.response();
    record.status = response?.status() ?? null;
    const headers = response?.headers() ?? {};
    record.contentType = headers["content-type"] ?? null;
    record.contentLength = headers["content-length"] ?? null;
    record.serverTiming = headers["server-timing"] ?? null;
    record.cacheControl = headers["cache-control"] ?? null;
    record.cfCacheStatus = headers["cf-cache-status"] ?? null;
    record.requestId = headers["x-request-id"] ?? null;
    finished.push(record);
  });
  page.on("requestfailed", (request) => {
    const record = requests.get(request);
    if (!record) return;
    record.finishedAt = now();
    record.failure = request.failure()?.errorText ?? "failed";
    finished.push(record);
  });

  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const coldStart = now();
  await page.goto(new URL(homePath, baseURL).toString(), { waitUntil: "domcontentloaded" });
  await page.locator("h1, h2, [role='heading']").first().waitFor({
    state: "visible",
    timeout: 15_000,
  });
  const coldDurationMs = now() - coldStart;

  const results = [];
  async function transition(name, targetPath, clickTarget) {
    const beforeFinished = finished.length;
    const beforeDocuments = documents.length;
    const sourcePath = routeName(page.url());
    const start = now();
    await clickTarget.click();
    await waitUntilUsable(page, targetPath);
    const durationMs = now() - start;
    const transitionRequests = finished.slice(beforeFinished).map((request) => ({
      ...request,
      durationMs: request.finishedAt - request.startedAt,
      relativeStartMs: request.startedAt - start,
    }));
    const routeDataRequests = transitionRequests.filter(
      (request) =>
        request.resourceType === "fetch" ||
        request.url.includes(".data") ||
        request.url.includes("/api/"),
    );
    results.push({
      name,
      from: sourcePath,
      targetPath,
      durationMs,
      documentRequests: documents.length - beforeDocuments,
      routeDataRequests,
      ...(process.env.PERF_DETAILS === "1" ? { requests: transitionRequests } : {}),
    });
  }

  const run = async (name, targetPath, selector) => {
    const target = page.locator(selector).first();
    await target.waitFor({ state: "visible", timeout: 15_000 });
    await transition(name, targetPath, target);
  };

  await run("home-to-public-profile", "/u/", "a[href*='/u/']:visible");
  await run("public-profile-to-home", "/", "a[href$='/es']:visible, a[href='/']:visible");
  await run("home-to-store", "/store", "a[href*='/store']:visible");
  await run(
    "store-to-home",
    "/",
    "a[href$='/es']:visible, a[href='/']:visible, a[href*='srcboard.me/es']:visible",
  );
  await run("home-to-community", "/friends", "a[href*='/friends']:visible");
  await run(
    "community-to-home",
    "/",
    "a[href$='/es']:visible, a[href='/']:visible, a[href*='srcboard.me/es']:visible",
  );
  await run("home-to-post", "/posts/", "a[href*='/posts/']:visible");

  const tracePath = `${outputDir}/production-navigation-${Date.now()}.zip`;
  await context.tracing.stop({ path: tracePath });
  await browser.close();

  console.log(
    JSON.stringify(
      {
        baseURL,
        viewport,
        coldDocumentMs: coldDurationMs,
        totalDocumentRequests: documents.length,
        tracePath,
        results,
      },
      null,
      2,
    ),
  );
}

await main();

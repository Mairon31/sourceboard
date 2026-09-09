from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"expected source not found in {path}: {old[:80]!r}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "app/routes/_index.tsx",
    'import { useState } from "react";',
    'import { useRef, useState, type KeyboardEvent } from "react";',
)
replace_once(
    "app/routes/_index.tsx",
    '  const [feedError, setFeedError] = useState<Partial<Record<FeedMode, string>>>({});\n  const active = feedOptions.find((option) => option.value === feed) ?? feedOptions[0];',
    '  const [feedError, setFeedError] = useState<Partial<Record<FeedMode, string>>>({});\n  const feedTabRefs = useRef<Record<FeedMode, HTMLButtonElement | null>>({\n    recent: null,\n    friends: null,\n    answered: null,\n    verified: null,\n  });\n  const active = feedOptions.find((option) => option.value === feed) ?? feedOptions[0];',
)
replace_once(
    "app/routes/_index.tsx",
    '  function selectFeed(nextFeed: FeedMode) {\n    setFeed(nextFeed);\n    if (!loadedFeeds.has(nextFeed)) void loadFeed(nextFeed);\n  }',
    '  function selectFeed(nextFeed: FeedMode) {\n    setFeed(nextFeed);\n    if (!loadedFeeds.has(nextFeed)) void loadFeed(nextFeed);\n  }\n\n  function handleFeedKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {\n    let nextIndex: number | null = null;\n    if (event.key === "ArrowRight") nextIndex = (index + 1) % feedOptions.length;\n    if (event.key === "ArrowLeft") nextIndex = (index - 1 + feedOptions.length) % feedOptions.length;\n    if (event.key === "Home") nextIndex = 0;\n    if (event.key === "End") nextIndex = feedOptions.length - 1;\n    if (nextIndex === null) return;\n\n    event.preventDefault();\n    const nextFeed = feedOptions[nextIndex].value;\n    selectFeed(nextFeed);\n    feedTabRefs.current[nextFeed]?.focus();\n  }',
)
replace_once(
    "app/routes/_index.tsx",
    '        <nav\n          className="product-store-filter-bar product-feed-filter-tabs"\n          aria-label="Feed filters"\n        >\n          {feedOptions.map((option) => {',
    '        <nav\n          className="product-store-filter-bar product-feed-filter-tabs"\n          aria-label="Feed filters"\n          role="tablist"\n        >\n          {feedOptions.map((option, index) => {',
)
replace_once(
    "app/routes/_index.tsx",
    '              <button\n                key={option.value}\n                type="button"\n                className={`product-store-filter${feed === option.value ? " product-store-filter--active is-active" : ""}`}\n                aria-pressed={feed === option.value}\n                onClick={() => selectFeed(option.value)}\n              >',
    '              <button\n                key={option.value}\n                ref={(element) => {\n                  feedTabRefs.current[option.value] = element;\n                }}\n                id={`feed-tab-${option.value}`}\n                type="button"\n                role="tab"\n                aria-selected={feed === option.value}\n                aria-controls={`feed-panel-${option.value}`}\n                tabIndex={feed === option.value ? 0 : -1}\n                className={`product-store-filter${feed === option.value ? " product-store-filter--active is-active" : ""}`}\n                onClick={() => selectFeed(option.value)}\n                onKeyDown={(event) => handleFeedKeyDown(event, index)}\n              >',
)
replace_once(
    "app/routes/_index.tsx",
    '        <FeedCollection\n          posts={posts}\n          unavailable={data.unavailable}\n          loading={loadingFeed === feed}\n          error={feedError[feed] ?? null}\n        />',
    '        <div\n          id={`feed-panel-${feed}`}\n          role="tabpanel"\n          aria-labelledby={`feed-tab-${feed}`}\n          tabIndex={0}\n        >\n          <FeedCollection\n            posts={posts}\n            unavailable={data.unavailable}\n            loading={loadingFeed === feed}\n            error={feedError[feed] ?? null}\n          />\n        </div>',
)

replace_once(
    "tests/unit/product-overhaul-remaining-contracts.test.ts",
    '    expect(home).toContain("/resources/feed/${encodeURIComponent(nextFeed)}");\n    expect(feedResource).toContain("service.listFeed({ viewerId: userId, kind");',
    '    expect(home).toContain("/resources/feed/${encodeURIComponent(nextFeed)}");\n    expect(home).toContain(\'role="tablist"\');\n    expect(home).toContain(\'role="tab"\');\n    expect(home).toContain("aria-selected={feed === option.value}");\n    expect(home).toContain("handleFeedKeyDown");\n    expect(home).toContain(\'role="tabpanel"\');\n    expect(feedResource).toContain("service.listFeed({ viewerId: userId, kind");',
)

replace_once(
    "tests/e2e/account-surfaces.spec.ts",
    'page.getByRole("main").getByRole("heading", { name: "Appearance" })',
    'page.getByRole("main").getByRole("heading", { name: "Theme", exact: true })',
)
replace_once(
    "tests/e2e/core-product.spec.ts",
    '  await expect(\n    page.locator(".product-feed-cta").getByRole("link", { name: "Create post" }),\n  ).toBeVisible();',
    '  await expect(\n    page.getByRole("main").getByRole("link", { name: "Create post", exact: true }),\n  ).toBeVisible();',
)
replace_once(
    "tests/e2e/core-product.spec.ts",
    'page.getByRole("heading", { name: /Search results for/ })',
    'page.getByRole("heading", { name: /Results for/ })',
)
replace_once(
    "tests/e2e/navigation.spec.ts",
    '  await expect(page.getByRole("link", { name: "Store" })).toBeVisible();',
    '  await expect(\n    page\n      .getByRole("navigation", { name: "Primary navigation" })\n      .getByRole("link", { name: "Store", exact: true }),\n  ).toBeVisible();',
)
replace_once(
    "tests/e2e/seo.spec.ts",
    'test("robots exposes only the public sitemap entry point", async ({ request }) => {\n  const response = await request.get("/robots.txt");\n\n  expect(response.status()).toBe(200);\n  const body = await response.text();\n  expect(body).toContain("Disallow: /api/");\n  expect(body).toContain("Sitemap: http://localhost:5173/sitemap.xml");\n});',
    'test("robots exposes the canonical public sitemap and excludes private product routes", async ({\n  request,\n}) => {\n  const response = await request.get("/robots.txt");\n\n  expect(response.status()).toBe(200);\n  const body = await response.text();\n  expect(body).toContain("Disallow: /admin/");\n  expect(body).toContain("Disallow: /settings");\n  expect(body).toContain("Disallow: /notifications");\n  expect(body).toContain("Sitemap: https://srcboard.me/sitemap.xml");\n  expect(body).not.toContain("Disallow: /api/");\n});',
)

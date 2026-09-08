from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:120]!r}")
    file.write_text(text.replace(old, new), encoding="utf-8")


component = "app/components/admin/store/AdminEmotePackManager.tsx"

replace_once(
    component,
    '''  async function replaceImage(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    const form = new FormData(event.currentTarget);''',
    '''  async function replaceImage(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    const formElement = event.currentTarget;\n    const form = new FormData(formElement);''',
)
replace_once(component, "      event.currentTarget.reset();\n      setReplacing(false);", "      formElement.reset();\n      setReplacing(false);")

replace_once(
    component,
    '''      const response = await fetch(\n        `/api/admin/catalog/emote-packs/${encodeURIComponent(selectedPackId)}`,\n      );''',
    '''      const response = await fetch(\n        `/api/admin/catalog/emote-packs/${encodeURIComponent(selectedPackId)}`,\n        { cache: "no-store" },\n      );''',
)

replace_once(
    component,
    '''  async function createPack(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    const form = new FormData(event.currentTarget);''',
    '''  async function createPack(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    const formElement = event.currentTarget;\n    const form = new FormData(formElement);''',
)
replace_once(
    component,
    '''      event.currentTarget.reset();\n      await onRefreshPacks();\n      if (payload?.pack?.id) onSelectPack(payload.pack.id);''',
    '''      formElement.reset();\n      await onRefreshPacks();\n      if (payload?.pack?.id) onSelectPack(payload.pack.id);''',
)

replace_once(
    component,
    '''  async function uploadEmote(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    if (!selectedPackId) return;\n    const form = new FormData(event.currentTarget);''',
    '''  async function uploadEmote(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    if (!selectedPackId) return;\n    const formElement = event.currentTarget;\n    const form = new FormData(formElement);''',
)
replace_once(
    component,
    '''      event.currentTarget.reset();\n      onStatus("Emote added to the selected pack.");\n      await Promise.all([onRefreshPacks(), loadDetail()]);''',
    '''      formElement.reset();\n      onStatus("Emote added to the selected pack.");\n      await loadDetail();\n      await onRefreshPacks();''',
)

route = "app/routes/admin-store.tsx"
replace_once(
    route,
    '''  async function createCosmetic(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    const form = new FormData(event.currentTarget);''',
    '''  async function createCosmetic(event: FormEvent<HTMLFormElement>) {\n    event.preventDefault();\n    const formElement = event.currentTarget;\n    const form = new FormData(formElement);''',
)
replace_once(
    route,
    '''      event.currentTarget.reset();\n      setStatus("Draft cosmetic created. Review it below before publishing.");''',
    '''      formElement.reset();\n      setStatus("Draft cosmetic created. Review it below before publishing.");''',
)

test = "tests/e2e/admin.spec.ts"
replace_once(
    test,
    '''test("authorized Admin Store uploads an emote into a draft pack without media network failures", async ({\n  page,\n}) => {\n  await installAdminStoreFixture(page);''',
    '''test("authorized Admin Store uploads an emote into a draft pack without media network failures", async ({\n  page,\n}, testInfo) => {\n  await installAdminStoreFixture(page);\n  const uploadShortcode = `e2e_uploaded_${testInfo.retry}_${Date.now().toString(36)}`;''',
)
replace_once(
    test,
    '''  await page.goto("/admin/store");\n  await waitForUiReady(page);\n  await page.getByRole("tab", { name: "Emote packs" }).click();''',
    '''  await page.goto("/admin/store");\n  await expect(page.getByRole("heading", { name: "Catalog control center" })).toBeVisible({\n    timeout: 30_000,\n  });\n  await page.getByRole("tab", { name: "Emote packs" }).click();''',
)
replace_once(
    test,
    '''  await workspace.locator('input[name="shortcode"]').fill("e2e_uploaded");''',
    '''  await workspace.locator('input[name="shortcode"]').fill(uploadShortcode);''',
)
replace_once(
    test,
    '''  const createResponse = await createResponsePromise;\n  expect(createResponse.status()).toBe(201);\n\n  const uploaded = page.locator(".admin-store-emote-card").filter({ hasText: "E2E Uploaded" });\n  await expect(uploaded.getByText(":e2e_uploaded:", { exact: true })).toBeVisible();''',
    '''  const createResponse = await createResponsePromise;\n  expect(createResponse.status()).toBe(201);\n  expect(pageErrors).toEqual([]);\n  const created = (await createResponse.json()) as { id?: string };\n  expect(created.id).toBeTruthy();\n\n  const detailResponse = await page.request.get(\n    "/api/admin/catalog/emote-packs/e2e-admin-draft-pack",\n  );\n  expect(detailResponse.status()).toBe(200);\n  const detailPayload = (await detailResponse.json()) as {\n    pack?: { emotes?: Array<{ shortcode?: string }> };\n  };\n  expect(detailPayload.pack?.emotes?.some((emote) => emote.shortcode === uploadShortcode)).toBe(true);\n\n  const directMediaResponse = await page.request.get(\n    `/api/admin/catalog/emotes/${encodeURIComponent(created.id!)}/media`,\n  );\n  expect(directMediaResponse.status()).toBe(200);\n\n  const uploaded = page.locator(".admin-store-emote-card").filter({ hasText: "E2E Uploaded" });\n  await expect(uploaded.getByText(`:${uploadShortcode}:`, { exact: true })).toBeVisible();''',
)

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
    '''      event.currentTarget.reset();\n      onStatus("Emote added to the selected pack.");\n      await Promise.all([onRefreshPacks(), loadDetail()]);''',
    '''      event.currentTarget.reset();\n      onStatus("Emote added to the selected pack.");\n      await loadDetail();\n      await onRefreshPacks();''',
)

test = "tests/e2e/admin.spec.ts"
replace_once(
    test,
    '''test("authorized Admin Store uploads an emote into a draft pack without media network failures", async ({\n  page,\n}) => {\n  await installAdminStoreFixture(page);''',
    '''test("authorized Admin Store uploads an emote into a draft pack without media network failures", async ({\n  page,\n}, testInfo) => {\n  await installAdminStoreFixture(page);\n  const uploadShortcode = `e2e_uploaded_${testInfo.retry}_${Date.now().toString(36)}`;''',
)
replace_once(
    test,
    '''  await workspace.locator('input[name="shortcode"]').fill("e2e_uploaded");''',
    '''  await workspace.locator('input[name="shortcode"]').fill(uploadShortcode);''',
)
replace_once(
    test,
    '''  await expect(uploaded.getByText(":e2e_uploaded:", { exact: true })).toBeVisible();''',
    '''  await expect(uploaded.getByText(`:${uploadShortcode}:`, { exact: true })).toBeVisible();''',
)

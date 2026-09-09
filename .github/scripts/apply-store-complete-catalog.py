from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement target, found {count}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "app/routes/store.tsx",
    '''function partitionStoreItems(items: StoreItemView[], authenticated: boolean) {
  const featured = items.filter((item) => item.featured);
  const used = new Set(featured.map((item) => item.id));
  const owned = authenticated
    ? items.filter((item) => (item.owned || item.equipped) && !used.has(item.id))
    : [];
  owned.forEach((item) => used.add(item.id));
  const newest = [...items]
    .filter((item) => !used.has(item.id))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 8);
  newest.forEach((item) => used.add(item.id));
  const browse = items.filter((item) => !used.has(item.id));
  return { featured, owned, newest, browse };
}''',
    '''function partitionStoreItems(items: StoreItemView[], authenticated: boolean) {
  const featured = items.filter((item) => item.featured);
  const owned = authenticated ? items.filter((item) => item.owned || item.equipped) : [];
  const newest = [...items]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 8);
  const browse = items;
  return { featured, owned, newest, browse };
}''',
)

replace_once(
    "app/routes/store.tsx",
    '''        {sections.newest.length ? (
          <StoreSection title="New" description="Recent additions you have not seen above.">
            {renderItems(sections.newest)}
          </StoreSection>
        ) : null}

        {sections.browse.length ? (
          <StoreSection title="Browse" description="More items in the selected category.">
            {renderItems(sections.browse)}
          </StoreSection>
        ) : null}''',
    '''        {sections.newest.length ? (
          <StoreSection title="New" description="Recent additions in the selected category.">
            {renderItems(sections.newest)}
          </StoreSection>
        ) : null}

        {sections.browse.length ? (
          <StoreSection title="All items" description="Full catalog in the selected category.">
            {renderItems(sections.browse)}
          </StoreSection>
        ) : null}''',
)

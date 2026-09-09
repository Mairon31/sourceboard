from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement target, found {count}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "app/components/product/ProfileHero.tsx",
    '''        <div className="product-profile-summary" aria-label="Profile summary">''',
    '''        <div
          className="product-profile-summary product-profile-stats--compact"
          aria-label="Profile summary"
        >''',
)

replace_once(
    "tests/unit/profile-friends-workspace.test.ts",
    '''  it("provides Friends, Requests, Add and Discover modes with search", () => {
    expect(friendsRoute).toContain("<FriendsWorkspace");
    expect(friendsWorkspace).toContain("Friends <span");
    expect(friendsWorkspace).toContain("Requests <span");
    expect(friendsWorkspace).toContain("Add");
    expect(friendsWorkspace).toContain("Discover");''',
    '''  it("provides Friends, Incoming, Outgoing, Add and Discover modes with search", () => {
    expect(friendsRoute).toContain("<FriendsWorkspace");
    expect(friendsWorkspace).toContain('friends: "Friends"');
    expect(friendsWorkspace).toContain('incoming: "Incoming"');
    expect(friendsWorkspace).toContain('outgoing: "Outgoing"');
    expect(friendsWorkspace).toContain('add: "Add"');
    expect(friendsWorkspace).toContain('discover: "Discover"');''',
)

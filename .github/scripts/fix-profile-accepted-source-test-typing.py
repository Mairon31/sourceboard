from pathlib import Path

path = Path("tests/unit/post-policy.test.ts")
text = path.read_text()
old = '''  const listAcceptedByContributor = vi.fn(async () => ({ posts: [], nextCursor: null }));'''
new = '''  const listAcceptedByContributor = vi.fn(
    async (): Promise<{ posts: PostWithAuthor[]; nextCursor: string | null }> => ({
      posts: [],
      nextCursor: null,
    }),
  );'''
if text.count(old) != 1:
    raise SystemExit("expected one listAcceptedByContributor mock")
path.write_text(text.replace(old, new, 1))

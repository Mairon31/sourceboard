import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useLoaderData, useSearchParams } from "react-router";
import {
  POST_CATEGORIES,
  parsePostCategorySlug,
  type PostCategorySlug,
} from "../../shared/posts/categories";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createD1PostStore } from "../../worker/posts/store";
import { createPostService } from "../../worker/posts/service";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";
import { readViewerLikedPostIds } from "../data/viewer-post-likes";
import { PostCard } from "../components/product/PostCard";
import { ProductShell } from "../components/product/ProductShell";
import { Card } from "../components/ui";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n";

type LoaderArgs = ServerLoaderArgs;
type FeedMode = "recent" | "friends" | "answered" | "verified";

const feedOptions: Array<{ value: FeedMode; label: MessageKey; description: MessageKey }> = [
  { value: "recent", label: "home.feed.recent", description: "home.feed.recentDescription" },
  { value: "friends", label: "home.feed.friends", description: "home.feed.friendsDescription" },
  { value: "answered", label: "home.feed.answered", description: "home.feed.answeredDescription" },
  { value: "verified", label: "home.feed.verified", description: "home.feed.verifiedDescription" },
];

function feedCacheKey(feed: FeedMode, categorySlug: PostCategorySlug | null) {
  return `${feed}:${categorySlug ?? "all"}`;
}

export async function loader({ request, context }: LoaderArgs) {
  const url = new URL(request.url);
  const rawCategory = url.searchParams.get("category");
  const categorySlug = rawCategory ? parsePostCategorySlug(rawCategory) : null;

  return withOptionalServerSession(
    request,
    context,
    (unavailable) => ({ unavailable, categorySlug, posts: [] }),
    async (runtime, userId) => {
      const service = createPostService({
        store: createD1PostStore(runtime.db),
        profileStore: createD1ProfileStore(runtime.db),
      });
      const recent = await service.listFeed({
        viewerId: userId,
        kind: "recent",
        categorySlug,
        cursor: null,
        limit: 20,
      });
      const likedIds = await readViewerLikedPostIds(
        runtime.db,
        userId,
        recent.posts.map((post) => post.id),
      );
      return {
        unavailable: false,
        categorySlug,
        posts: recent.posts.map((post) => ({
          ...post,
          reaction: { ...post.reaction, viewerReacted: likedIds.has(post.id) },
        })),
      };
    },
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;
type FeedPosts = LoaderData["posts"];

type FeedResourceResponse = {
  unavailable: boolean;
  posts: FeedPosts;
};

function FeedCollection({
  posts,
  unavailable,
  loading,
  error,
}: {
  posts: FeedPosts;
  unavailable: boolean;
  loading?: boolean;
  error?: string | null;
}) {
  const { t } = useI18n();
  if (loading) {
    return (
      <div className="product-empty-state product-empty-state--compact" role="status">
        <strong>{t("home.feed.loadingTitle")}</strong>
        <p>{t("home.feed.loadingDescription")}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="product-empty-state product-empty-state--compact" role="alert">
        <strong>{t("home.feed.unavailableTitle")}</strong>
        <p>{error}</p>
      </div>
    );
  }
  if (unavailable) {
    return (
      <Card className="product-empty-state">
        <strong>{t("home.feed.unavailableTitle")}</strong>
        <p>{t("home.feed.unavailableDescription")}</p>
      </Card>
    );
  }
  if (!posts.length) {
    return (
      <div className="product-empty-state product-empty-state--compact">
        <strong>{t("home.feed.emptyTitle")}</strong>
        <p>{t("home.feed.emptyDescription")}</p>
      </div>
    );
  }
  return (
    <div className="product-feed-list">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

export default function HomeRoute() {
  const data = useLoaderData<LoaderData>();
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawCategory = searchParams.get("category");
  const categorySlug = rawCategory ? parsePostCategorySlug(rawCategory) : null;
  const initialKey = feedCacheKey("recent", data.categorySlug);
  const [feedCache, setFeedCache] = useState<Record<string, FeedPosts>>({
    [initialKey]: data.posts,
  });
  const [feed, setFeed] = useState<FeedMode>("recent");
  const [loadedKeys, setLoadedKeys] = useState<Set<string>>(
    () => new Set<string>(data.unavailable ? [] : [initialKey]),
  );
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<Record<string, string | undefined>>({});
  const feedTabRefs = useRef<Record<FeedMode, HTMLButtonElement | null>>({
    recent: null,
    friends: null,
    answered: null,
    verified: null,
  });
  const active = feedOptions.find((option) => option.value === feed) ?? feedOptions[0];
  const activeKey = feedCacheKey(feed, categorySlug);
  const posts = feedCache[activeKey] ?? [];

  async function loadFeed(nextFeed: FeedMode, nextCategory: PostCategorySlug | null) {
    const key = feedCacheKey(nextFeed, nextCategory);
    if (data.unavailable || loadedKeys.has(key) || loadingKey === key) return;
    setLoadingKey(key);
    setFeedError((current) => ({ ...current, [key]: undefined }));
    try {
      const resourceSearch = new URLSearchParams();
      if (nextCategory) resourceSearch.set("category", nextCategory);
      const suffix = resourceSearch.size ? `?${resourceSearch.toString()}` : "";
      const response = await fetch(`/resources/feed/${encodeURIComponent(nextFeed)}${suffix}`, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as FeedResourceResponse | null;
      if (!response.ok || !payload || payload.unavailable) {
        throw new Error(t("home.feed.loadError"));
      }
      setFeedCache((current) => ({ ...current, [key]: payload.posts }));
      setLoadedKeys((current) => new Set(current).add(key));
    } catch (error) {
      setFeedError((current) => ({
        ...current,
        [key]: error instanceof Error ? error.message : t("home.feed.loadError"),
      }));
    } finally {
      setLoadingKey((current) => (current === key ? null : current));
    }
  }

  useEffect(() => {
    if (rawCategory && !categorySlug) {
      const next = new URLSearchParams(searchParams);
      next.delete("category");
      setSearchParams(next, { replace: true });
      return;
    }
    if (!data.unavailable && !loadedKeys.has(activeKey) && loadingKey !== activeKey) {
      void loadFeed(feed, categorySlug);
    }
  }, [
    activeKey,
    categorySlug,
    data.unavailable,
    feed,
    loadedKeys,
    loadingKey,
    rawCategory,
    searchParams,
    setSearchParams,
  ]);

  function selectFeed(nextFeed: FeedMode) {
    setFeed(nextFeed);
    const key = feedCacheKey(nextFeed, categorySlug);
    if (!loadedKeys.has(key)) void loadFeed(nextFeed, categorySlug);
  }

  function selectCategory(value: string) {
    const nextCategory = value ? parsePostCategorySlug(value) : null;
    const next = new URLSearchParams(searchParams);
    if (nextCategory) next.set("category", nextCategory);
    else next.delete("category");
    setSearchParams(next);
    const key = feedCacheKey(feed, nextCategory);
    if (!loadedKeys.has(key)) void loadFeed(feed, nextCategory);
  }

  function handleFeedKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % feedOptions.length;
    if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + feedOptions.length) % feedOptions.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = feedOptions.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextFeed = feedOptions[nextIndex].value;
    selectFeed(nextFeed);
    feedTabRefs.current[nextFeed]?.focus();
  }

  return (
    <ProductShell wide>
      <section className="product-home-compact-lead">
        <div className="product-home-compact-lead__copy">
          <span className="product-eyebrow">{t("home.hero.eyebrow")}</span>
          <h1>{t("home.hero.title")}</h1>
          <p>{t("home.hero.description")}</p>
        </div>
        <Link className="product-nav__create product-home-create" to="/post/new" prefetch="intent">
          {t("nav.create")}
        </Link>
      </section>

      <section className="product-feed-workspace" aria-labelledby="feed-heading">
        <div className="product-feed-workspace__heading">
          <div>
            <span className="product-eyebrow">{t("home.feed.eyebrow")}</span>
            <h2 id="feed-heading">{t(active.label)}</h2>
            <p>{t(active.description)}</p>
          </div>
          <label className="product-field-native product-home-category-filter">
            <span>{t("home.feed.category")}</span>
            <select
              aria-label={t("home.feed.categoryAria")}
              value={categorySlug ?? ""}
              onChange={(event) => selectCategory(event.currentTarget.value)}
            >
              <option value="">{t("home.feed.allCategories")}</option>
              {POST_CATEGORIES.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav
          className="product-store-filter-bar product-feed-filter-tabs"
          aria-label={t("home.feed.filtersAria")}
          role="tablist"
        >
          {feedOptions.map((option, index) => {
            return (
              <button
                key={option.value}
                ref={(element) => {
                  feedTabRefs.current[option.value] = element;
                }}
                id={`feed-tab-${option.value}`}
                type="button"
                role="tab"
                aria-selected={feed === option.value}
                aria-controls={`feed-panel-${option.value}`}
                tabIndex={feed === option.value ? 0 : -1}
                className={`product-store-filter${feed === option.value ? " product-store-filter--active is-active" : ""}`}
                onClick={() => selectFeed(option.value)}
                onKeyDown={(event) => handleFeedKeyDown(event, index)}
              >
                <span className="product-feed-filter-tabs__label">{t(option.label)}</span>
              </button>
            );
          })}
        </nav>
        <div
          id={`feed-panel-${feed}`}
          role="tabpanel"
          aria-labelledby={`feed-tab-${feed}`}
          tabIndex={0}
        >
          <FeedCollection
            posts={posts}
            unavailable={data.unavailable}
            loading={loadingKey === activeKey}
            error={feedError[activeKey] ?? null}
          />
        </div>
      </section>
    </ProductShell>
  );
}

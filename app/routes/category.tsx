import { Link, useLoaderData, type MetaFunction } from "react-router";
import { getPostCategory, parsePostCategorySlug } from "../../shared/posts/categories";
import {
  createCategoryService,
  isMissingCategorySchemaError,
} from "../../worker/categories/service";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createD1PostStore } from "../../worker/posts/store";
import { createPostService } from "../../worker/posts/service";
import { PostCard } from "../components/product/PostCard";
import { ProductShell } from "../components/product/ProductShell";
import { Card } from "../components/ui";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";
import { useI18n } from "../i18n/I18nProvider";
import { readViewerLikedPostIds } from "../data/viewer-post-likes";
import { readPostActionPermissions, withPostActionPermissions } from "../data/post-actions";
import { readSourceBoardRequestContext } from "../../shared/router-context";
import { requestedLocale } from "../data/locale.server";
import { localizedPageMeta } from "../../shared/seo/official-pages";

interface LoaderArgs extends ServerLoaderArgs {
  params: { categorySlug?: string };
}

export async function loader({ request, context, params }: LoaderArgs) {
  const rawSlug = params.categorySlug?.trim() ?? "";
  const locale = requestedLocale(request);
  const staticSlug = parsePostCategorySlug(rawSlug);
  let category = staticSlug ? getPostCategory(staticSlug) : null;
  const db = readSourceBoardRequestContext(context)?.env.DB;
  if (!category && db && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawSlug)) {
    try {
      const dynamic = await createCategoryService(db).get(rawSlug);
      category = dynamic
        ? {
            slug: dynamic.slug,
            label: dynamic.name,
            description: dynamic.description,
            aliases: dynamic.aliases,
            isNsfw: dynamic.isNsfw,
            isArchived: dynamic.isArchived,
            noindex: dynamic.noindex,
          }
        : null;
    } catch (error) {
      if (!isMissingCategorySchemaError(error)) throw error;
    }
  }
  if (!category) {
    throw new Response("Category not found", { status: 404 });
  }
  const url = new URL(request.url);

  return withOptionalServerSession(
    request,
    context,
    (unavailable) => ({ locale, unavailable, category, posts: [] }),
    async (runtime, userId) => {
      const service = createPostService({
        store: createD1PostStore(runtime.db),
        profileStore: createD1ProfileStore(runtime.db),
      });
      const feed = await service.listFeed({
        viewerId: userId,
        kind: "recent",
        categorySlug: category.slug,
        cursor: url.searchParams.get("cursor"),
        limit: 20,
      });
      const likedIds = await readViewerLikedPostIds(
        runtime.db,
        userId,
        feed.posts.map((post) => post.id),
      );
      const actionPermissions = await readPostActionPermissions(runtime.db, userId);
      return {
        locale,
        unavailable: false,
        category,
        posts: withPostActionPermissions(
          feed.posts.map((post) => ({
            ...post,
            reaction: { ...post.reaction, viewerReacted: likedIds.has(post.id) },
          })),
          actionPermissions,
        ),
      };
    },
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export const meta: MetaFunction<typeof loader> = ({ loaderData: data }) => {
  if (!data?.category) return [{ name: "robots", content: "noindex, nofollow" }];
  return localizedPageMeta({
    locale: data.locale,
    path: `/category/${encodeURIComponent(data.category.slug)}`,
    title: `${data.category.label} · SourceBoard`,
    description: data.category.description || data.category.label,
    indexable: !data.category.noindex,
  });
};

export default function CategoryRoute() {
  const { t } = useI18n();
  const data = useLoaderData<LoaderData>();

  return (
    <ProductShell wide>
      <section className="product-home-compact-lead">
        <div className="product-home-compact-lead__copy">
          <span className="product-eyebrow">{t("category.eyebrow")}</span>
          <h1>{data.category.label}</h1>
          <p>{data.category.description}</p>
        </div>
        <Link
          className="product-nav__create product-home-create"
          to={`/${data.locale}`}
          prefetch="intent"
        >
          {t("category.allPosts")}
        </Link>
      </section>

      <section className="product-feed-workspace" aria-labelledby="category-feed-heading">
        <div className="product-feed-workspace__heading">
          <div>
            <span className="product-eyebrow">{t("category.recentRequests")}</span>
            <h2 id="category-feed-heading">{data.category.label}</h2>
          </div>
        </div>
        {data.unavailable ? (
          <Card className="product-empty-state">
            <strong>{t("category.unavailableTitle")}</strong>
            <p>{t("category.unavailableDescription")}</p>
          </Card>
        ) : data.posts.length ? (
          <div className="product-feed-list">
            {data.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="product-empty-state product-empty-state--compact">
            <strong>{t("category.emptyTitle")}</strong>
            <p>{t("category.emptyDescription")}</p>
          </div>
        )}
      </section>
    </ProductShell>
  );
}

import { useLoaderData, useRevalidator } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import { createD1PostStore } from "../../worker/posts/store";
import { createPostService } from "../../worker/posts/service";
import { createReputationReader } from "../../worker/reputation/read";
import { AuthRequiredCard } from "../components/product/AuthRequiredCard";
import { ProfileAccountActions } from "../components/product/ProfileAccountActions";
import { ProfileEditor } from "../components/product/ProfileEditor";
import { ProductShell } from "../components/product/ProductShell";
import { loadAdminAccess } from "../data/admin-access";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";
import { useI18n } from "../i18n/I18nProvider";
import { PostCard } from "../components/product/PostCard";
import { readPostActionPermissions, withPostActionPermissions } from "../data/post-actions";

export async function loader({ request, context }: ServerLoaderArgs) {
  const [profileResult, adminAccess] = await Promise.all([
    withServerSession(
      request,
      context,
      (unavailable) => ({
        authenticated: false as const,
        unavailable,
        profile: null,
        deletedPosts: [],
      }),
      async (runtime, userId) => {
        const profileService = createProfileService({
          store: createD1ProfileStore(runtime.db),
          reputation: createReputationReader(runtime.db),
        });
        const postService = createPostService({
          store: createD1PostStore(runtime.db),
          profileStore: createD1ProfileStore(runtime.db),
        });
        const [mine, deletedPosts] = await Promise.all([
          profileService.getMyProfile(userId),
          postService.listRecentlyDeleted(userId, 20),
        ]);
        const profile = await profileService.getPublicProfile(mine.profile.username, userId);
        const actionPermissions = await readPostActionPermissions(runtime.db, userId);
        return {
          authenticated: true as const,
          unavailable: false,
          profile,
          deletedPosts: withPostActionPermissions(deletedPosts, actionPermissions),
        };
      },
    ),
    loadAdminAccess(request, context),
  ]);
  return { ...profileResult, canAccessAdmin: adminAccess.authorized };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function MyProfileRoute() {
  const data = useLoaderData<LoaderData>();
  const revalidator = useRevalidator();

  if (!data.authenticated || !data.profile) {
    return (
      <ProductShell wide>
        <AuthRequiredCard unavailable={data.unavailable} />
      </ProductShell>
    );
  }

  return (
    <ProductShell wide>
      <ProfileEditor profile={data.profile} />
      <RecentlyDeletedPosts posts={data.deletedPosts} onChanged={() => revalidator.revalidate()} />
      <div className="product-profile-secondary">
        <ProfileAccountActions canAccessAdmin={data.canAccessAdmin} />
      </div>
    </ProductShell>
  );
}

function RecentlyDeletedPosts({
  posts,
  onChanged,
}: {
  posts: LoaderData["deletedPosts"];
  onChanged: () => void;
}) {
  const { t } = useI18n();
  if (!posts.length) return null;
  return (
    <section
      className="product-profile-recently-deleted"
      aria-labelledby="recently-deleted-heading"
    >
      <header className="product-profile-recently-deleted__header">
        <div>
          <span className="product-eyebrow">{t("profile.recentlyDeleted.eyebrow")}</span>
          <h2 id="recently-deleted-heading">{t("profile.recentlyDeleted.title")}</h2>
        </div>
        <p>{t("profile.recentlyDeleted.description")}</p>
      </header>
      <div className="product-profile-recently-deleted__list">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} compact manage onChanged={onChanged} />
        ))}
      </div>
    </section>
  );
}

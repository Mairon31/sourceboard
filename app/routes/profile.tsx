import {
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
  type MetaFunction,
} from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import { createD1PostStore } from "../../worker/posts/store";
import { createPostService } from "../../worker/posts/service";
import { createReputationReader } from "../../worker/reputation/read";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";
import { useI18n } from "../i18n/I18nProvider";
import { NotFoundPage } from "../components/product/NotFoundPage";
import { ProfileActivity } from "../components/product/ProfileActivity";
import { ProfileHero } from "../components/product/ProfileHero";
import { AchievementIcon } from "../components/product/AchievementIcon";
import { ProductShell, PageHeader } from "../components/product/ProductShell";
import { Badge, Card } from "../components/ui";
import { readPostActionPermissions, withPostActionPermissions } from "../data/post-actions";

interface LoaderArgs extends ServerLoaderArgs {
  params: { username?: string };
}

export async function loader({ params, request, context }: LoaderArgs) {
  const profileResult = await withOptionalServerSession(
    request,
    context,
    (unavailable) => ({
      profile: null,
      activityPosts: [],
      acceptedSourcePosts: [],
      unavailable,
    }),
    async (runtime, userId) => {
      const profileStore = createD1ProfileStore(runtime.db);
      const profile = await createProfileService({
        store: profileStore,
        reputation: createReputationReader(runtime.db),
      }).getPublicProfile(params.username ?? "", userId);
      if (!profile) {
        return {
          profile: null,
          activityPosts: [],
          acceptedSourcePosts: [],
          unavailable: false,
        };
      }
      const activity = await createPostService({
        store: createD1PostStore(runtime.db),
        profileStore,
      }).listProfileActivity({ authorId: profile.id, viewerId: userId, limit: 24 });
      const actionPermissions = await readPostActionPermissions(runtime.db, userId);
      return {
        profile,
        activityPosts: withPostActionPermissions(activity.posts, actionPermissions),
        acceptedSourcePosts: withPostActionPermissions(activity.acceptedSources, actionPermissions),
        unavailable: false,
      };
    },
  );
  if (!profileResult.unavailable && !profileResult.profile) {
    throw new Response("Profile not found", { status: 404 });
  }
  return profileResult;
}

type LoaderData = Awaited<ReturnType<typeof loader>>;
type PublicProfile = NonNullable<LoaderData["profile"]>;

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const profile = loaderData?.profile;
  if (!profile || loaderData.unavailable) {
    return [
      { title: "Profile unavailable · SourceBoard" },
      { name: "robots", content: "noindex, nofollow" },
    ];
  }
  const description =
    profile.bio.trim() ||
    `See ${profile.displayName}'s public source contributions on SourceBoard.`;
  const canonicalUrl = new URL(
    `/u/${encodeURIComponent(profile.username)}`,
    "https://srcboard.me",
  ).toString();
  const imageUrl = profile.avatarUrl
    ? new URL(profile.avatarUrl, canonicalUrl).toString()
    : undefined;
  return [
    { title: `${profile.displayName} (@${profile.username}) · SourceBoard` },
    { name: "description", content: description.slice(0, 180) },
    { name: "robots", content: "index, follow" },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { property: "og:type", content: "profile" },
    { property: "og:title", content: `${profile.displayName} on SourceBoard` },
    { property: "og:description", content: description.slice(0, 180) },
    ...(imageUrl ? [{ property: "og:image", content: imageUrl }] : []),
    { name: "twitter:card", content: imageUrl ? "summary_large_image" : "summary" },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        name: profile.displayName,
        description: description.slice(0, 500),
        url: canonicalUrl,
        mainEntity: {
          "@type": "Person",
          name: profile.displayName,
          identifier: `@${profile.username}`,
          ...(imageUrl ? { image: imageUrl } : {}),
        },
      },
    },
  ];
};

function ProfileServiceUnavailable() {
  const { t } = useI18n();
  return (
    <ProductShell wide>
      <Card className="product-empty-state">
        <PageHeader
          eyebrow={t("profile.serviceEyebrow")}
          title={t("profile.serviceTitle")}
          description={t("profile.serviceDescription")}
        />
        <p>{t("profile.serviceRetry")}</p>
      </Card>
    </ProductShell>
  );
}

function ContributionHistory({ profile }: { profile: PublicProfile }) {
  const { t } = useI18n();
  return (
    <section className="product-profile-contributions">
      <div className="product-profile-contributions__header">
        <div>
          <span className="product-eyebrow">{t("profile.contributions.eyebrow")}</span>
          <h2>{t("profile.contributions.title")}</h2>
        </div>
        <p>{t("profile.contributions.description")}</p>
      </div>
      <div
        className="product-profile-contributions__metrics"
        aria-label={t("profile.contributions.metricsAria")}
      >
        {profile.reputation !== undefined ? (
          <div className="product-profile-contributions__metric">
            <strong>{profile.reputation}</strong>
            <span>{t("profile.contributions.reputation")}</span>
          </div>
        ) : null}
        {profile.points !== undefined ? (
          <div className="product-profile-contributions__metric">
            <strong>{profile.points}</strong>
            <span>{t("profile.contributions.points")}</span>
          </div>
        ) : null}
        {profile.verifiedSources !== undefined ? (
          <div className="product-profile-contributions__metric">
            <strong>{profile.verifiedSources}</strong>
            <span>{t("profile.contributions.verifiedSources")}</span>
          </div>
        ) : null}
      </div>
      {profile.achievements?.length ? (
        <div
          className="product-profile-contributions__achievements"
          aria-label={t("profile.contributions.achievementsAria")}
        >
          {profile.achievements.map((achievement) => (
            <Badge key={achievement.id} tone="neutral">
              <AchievementIcon icon={achievement.icon} /> {achievement.name}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="product-store-preview-status">{t("profile.contributions.noAchievements")}</p>
      )}
    </section>
  );
}

export default function ProfileRoute() {
  const { profile, activityPosts, acceptedSourcePosts } = useLoaderData<LoaderData>();
  if (!profile) return <ProfileServiceUnavailable />;
  return (
    <ProductShell wide profileTheme={profile.cosmetics?.profileTheme}>
      <ProfileHero profile={profile} isOwnProfile={false} />
      <div className="product-profile-secondary">
        <ContributionHistory profile={profile} />
      </div>
      <ProfileActivity posts={activityPosts} acceptedSources={acceptedSourcePosts} />
    </ProductShell>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return <ProfileServiceUnavailable />;
}

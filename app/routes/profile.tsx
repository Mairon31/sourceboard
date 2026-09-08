import { useLoaderData, useRouteLoaderData, type MetaFunction } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import { createReputationReader } from "../../worker/reputation/read";
import type { RootLoaderData } from "../root";
import { loadAdminAccess } from "../data/admin-access";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";
import { ProfileAccountActions } from "../components/product/ProfileAccountActions";
import { ProfileEditor } from "../components/product/ProfileEditor";
import { ProfileHero } from "../components/product/ProfileHero";
import { ProductShell, PageHeader } from "../components/product/ProductShell";
import { Badge, Card } from "../components/ui";

interface LoaderArgs extends ServerLoaderArgs {
  params: { username?: string };
}

export async function loader({ params, request, context }: LoaderArgs) {
  const [profileResult, adminAccess] = await Promise.all([
    withServerSession(
      request,
      context,
      (unavailable) => ({ profile: null, unavailable }),
      async (runtime, userId) => ({
        profile: await createProfileService({
          store: createD1ProfileStore(runtime.db),
          reputation: createReputationReader(runtime.db),
        }).getPublicProfile(params.username ?? "", userId),
        unavailable: false,
      }),
    ),
    loadAdminAccess(request, context),
  ]);
  return { ...profileResult, canAccessAdmin: adminAccess.authorized };
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

function UnavailableProfile({ unavailable }: { unavailable: boolean }) {
  return (
    <ProductShell wide>
      <Card className="product-empty-state">
        <PageHeader
          eyebrow="Profile"
          title="Profile unavailable"
          description={
            unavailable
              ? "The profile service is not available in this environment yet."
              : "This profile is private, blocked or does not exist."
          }
        />
        <p>Public profile data is shown only after server-side privacy checks succeed.</p>
      </Card>
    </ProductShell>
  );
}

function ContributionHistory({ profile }: { profile: PublicProfile }) {
  return (
    <Card className="product-profile-contributions">
      <div className="product-profile-contributions__header">
        <div>
          <span className="product-eyebrow">Contribution</span>
          <h2>What this contributor has earned</h2>
        </div>
        <p>Updated from SourceBoard activity</p>
      </div>
      <div className="product-profile-contributions__metrics" aria-label="Contribution metrics">
        {profile.reputation !== undefined ? (
          <div className="product-profile-contributions__metric">
            <strong>{profile.reputation}</strong>
            <span>Reputation</span>
          </div>
        ) : null}
        {profile.points !== undefined ? (
          <div className="product-profile-contributions__metric">
            <strong>{profile.points}</strong>
            <span>Points</span>
          </div>
        ) : null}
        {profile.verifiedSources !== undefined ? (
          <div className="product-profile-contributions__metric">
            <strong>{profile.verifiedSources}</strong>
            <span>Verified sources</span>
          </div>
        ) : null}
      </div>
      {profile.achievements?.length ? (
        <div
          className="product-profile-contributions__achievements"
          aria-label="Earned achievements"
        >
          {profile.achievements.map((achievement) => (
            <Badge key={achievement.id} tone="neutral">
              {achievement.icon} {achievement.name}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="product-store-preview-status">No achievements have been earned yet.</p>
      )}
    </Card>
  );
}

export default function ProfileRoute() {
  const { profile, unavailable, canAccessAdmin } = useLoaderData<LoaderData>();
  const rootData = useRouteLoaderData<RootLoaderData>("root");
  const isOwnProfile = Boolean(profile && rootData?.session?.user.id === profile.id);
  if (!profile) return <UnavailableProfile unavailable={unavailable} />;
  return (
    <ProductShell wide>
      {isOwnProfile ? (
        <ProfileEditor profile={profile} />
      ) : (
        <ProfileHero profile={profile} isOwnProfile={false} />
      )}
      <ContributionHistory profile={profile} />
      {isOwnProfile ? <ProfileAccountActions canAccessAdmin={canAccessAdmin} /> : null}
    </ProductShell>
  );
}

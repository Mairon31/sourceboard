import { Link, useLoaderData } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import { createReputationReader } from "../../worker/reputation/read";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";
import { ProductShell, PageHeader } from "../components/product/ProductShell";
import { SocialActionButton } from "../components/product/SocialActionButton";
import { Avatar, Badge, Card } from "../components/ui";

interface LoaderArgs extends ServerLoaderArgs {
  params: { username?: string };
}

export async function loader({ params, request, context }: LoaderArgs) {
  return withServerSession(
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
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;
type PublicProfile = NonNullable<LoaderData["profile"]>;

const relationshipLabel = {
  NONE: "Not connected",
  FRIEND: "Friends",
  INCOMING: "Incoming request",
  OUTGOING: "Request sent",
  BLOCKED: "Blocked",
} as const;

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

function ProfileSocialLinks({ profile }: { profile: PublicProfile }) {
  if (!profile.socialLinks.length) {
    return <p className="product-store-preview-status">No public social links.</p>;
  }
  return (
    <div className="product-social-links">
      {profile.socialLinks.map((link) => (
        <a key={`${link.platform}-${link.url}`} href={link.url} target="_blank" rel="noreferrer">
          {link.platform}
        </a>
      ))}
    </div>
  );
}

function ProfileBanner({ profile }: { profile: PublicProfile }) {
  return (
    <div
      className={`product-profile-banner${profile.cosmetics?.profileBanner ? " product-profile-banner--nebula" : ""}`}
      aria-label={`${profile.displayName} profile banner`}
      style={profile.bannerUrl ? { backgroundImage: `url("${profile.bannerUrl}")` } : undefined}
    />
  );
}

function ProfileRelationshipBadge({ profile }: { profile: PublicProfile }) {
  return (
    <Badge tone={profile.relationship === "BLOCKED" ? "warning" : "neutral"}>
      {relationshipLabel[profile.relationship]}
    </Badge>
  );
}

function ProfileRelationshipAction({ profile }: { profile: PublicProfile }) {
  if (!profile.canRequestFriend) return null;
  return (
    <SocialActionButton
      endpoint={`/api/friends/${encodeURIComponent(profile.id)}/request`}
      method="POST"
      variant="secondary"
      onSuccess={() => undefined}
      successLabel="Request sent"
    >
      Send friend request
    </SocialActionButton>
  );
}

function ProfileIdentity({ profile }: { profile: PublicProfile }) {
  return (
    <div className="product-profile-identity">
      <div className="product-list-row__identity">
        <Avatar
          name={profile.displayName}
          src={profile.avatarUrl}
          size="xl"
          className={
            profile.cosmetics?.avatarFrame
              ? `sb-avatar--frame-${profile.cosmetics.avatarFrame}`
              : undefined
          }
        />
        <div className="product-profile-name">
          <span className="product-eyebrow">Public profile</span>
          <h1
            style={
              profile.cosmetics?.nameFont ? { fontFamily: profile.cosmetics.nameFont } : undefined
            }
          >
            {profile.displayName}
          </h1>
          <p>@{profile.username}</p>
        </div>
      </div>
      <div className="product-chip-row">
        <ProfileRelationshipBadge profile={profile} />
        <ProfileRelationshipAction profile={profile} />
      </div>
    </div>
  );
}

function ProfileStats({ profile }: { profile: PublicProfile }) {
  return (
    <div className="product-profile-stats">
      <div className="product-stat">
        <strong>{profile.friendCount}</strong>
        <span>Friends</span>
      </div>
      {profile.points !== undefined && (
        <div className="product-stat">
          <strong>{profile.points}</strong>
          <span>Points</span>
        </div>
      )}
      {profile.verifiedSources !== undefined && (
        <div className="product-stat">
          <strong>{profile.verifiedSources}</strong>
          <span>Verified sources</span>
        </div>
      )}
      <div className="product-stat">
        <strong>{profile.profileVisibility === "PUBLIC" ? "Public" : "Friends"}</strong>
        <span>Visibility</span>
      </div>
    </div>
  );
}

function ProfileHero({ profile }: { profile: PublicProfile }) {
  return (
    <Card className="product-profile-hero">
      <ProfileBanner profile={profile} />
      <div
        className={`product-profile-content${profile.cosmetics?.profileEffect ? ` product-profile-content--${profile.cosmetics.profileEffect}` : ""}`}
      >
        <ProfileIdentity profile={profile} />
        <p>{profile.bio || "This contributor has not added a bio yet."}</p>
        <ProfileStats profile={profile} />
        <ProfileSocialLinks profile={profile} />
      </div>
    </Card>
  );
}

function ContributionHistory({ profile }: { profile: PublicProfile }) {
  return (
    <>
      <PageHeader
        eyebrow="Contribution history"
        title="Reputation is earned in SourceBoard"
        description="Contribution points and achievements are calculated from the server-side ledger."
      />
      <Card className="product-empty-state">
        <p>
          Verified source rewards and achievement history are server-authoritative and append-only.
        </p>
        {profile.achievements?.length ? (
          <div className="product-chip-row" aria-label="Earned achievements">
            {profile.achievements.map((achievement) => (
              <Badge key={achievement.id} tone="neutral">
                {achievement.icon} {achievement.name}
              </Badge>
            ))}
          </div>
        ) : null}
        <Link className="product-text-action" to="/">
          Return to feed
        </Link>
      </Card>
    </>
  );
}

export default function ProfileRoute() {
  const { profile, unavailable } = useLoaderData<LoaderData>();
  if (!profile) return <UnavailableProfile unavailable={unavailable} />;
  return (
    <ProductShell wide>
      <ProfileHero profile={profile} />
      <ContributionHistory profile={profile} />
    </ProductShell>
  );
}

import type { PublicProfileDto } from "../../../worker/profile/types";
import { Badge, Card } from "../ui";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { ShareAction } from "./ShareAction";
import { SocialActionButton } from "./SocialActionButton";

const relationshipLabel = {
  NONE: "Not connected",
  FRIEND: "Friends",
  INCOMING: "Incoming request",
  OUTGOING: "Request sent",
  BLOCKED: "Blocked",
} as const;

interface ProfileHeroProps {
  profile: PublicProfileDto;
  isOwnProfile: boolean;
}

function ProfileBanner({ profile }: { profile: PublicProfileDto }) {
  return (
    <div
      className={`product-profile-banner${profile.cosmetics?.profileBanner ? " product-profile-banner--nebula" : ""}`}
      aria-label={`${profile.displayName} profile banner`}
      style={profile.bannerUrl ? { backgroundImage: `url("${profile.bannerUrl}")` } : undefined}
    />
  );
}

function ProfileSocialLinks({ profile }: { profile: PublicProfileDto }) {
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

function RelationshipAction({ profile, isOwnProfile }: ProfileHeroProps) {
  if (isOwnProfile || !profile.canRequestFriend) return null;
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

export function ProfileHero({ profile, isOwnProfile }: ProfileHeroProps) {
  return (
    <Card className="product-profile-hero">
      <ProfileBanner profile={profile} />
      <div className="product-profile-content">
        <div className="product-profile-identity">
          <div className="product-list-row__identity">
            <div className="product-profile-name">
              <span className="product-eyebrow">{isOwnProfile ? "Your profile" : "Public profile"}</span>
              <CosmeticIdentity
                displayName={profile.displayName}
                avatarUrl={profile.avatarUrl}
                avatarFrame={profile.cosmetics?.avatarFrame}
                profileEffect={profile.cosmetics?.profileEffect}
                nameFont={profile.cosmetics?.nameFont}
                mode="profile"
                nameAs="h1"
              />
              <p>@{profile.username}</p>
            </div>
          </div>
          <div className="product-chip-row">
            {!isOwnProfile ? (
              <Badge tone={profile.relationship === "BLOCKED" ? "warning" : "neutral"}>
                {relationshipLabel[profile.relationship]}
              </Badge>
            ) : null}
            <RelationshipAction profile={profile} isOwnProfile={isOwnProfile} />
            <ShareAction
              url={`/u/${encodeURIComponent(profile.username)}`}
              title={`${profile.displayName} on SourceBoard`}
            />
          </div>
        </div>

        <p>{profile.bio || "This contributor has not added a bio yet."}</p>

        <dl className="product-profile-stats product-profile-stats--compact">
          <div className="product-stat">
            <dt>Friends</dt>
            <dd>{profile.friendCount}</dd>
          </div>
          {profile.points !== undefined ? (
            <div className="product-stat">
              <dt>Points</dt>
              <dd>{profile.points}</dd>
            </div>
          ) : null}
          {profile.verifiedSources !== undefined ? (
            <div className="product-stat">
              <dt>Verified</dt>
              <dd>{profile.verifiedSources}</dd>
            </div>
          ) : null}
          <div className="product-stat">
            <dt>Visibility</dt>
            <dd>{profile.profileVisibility === "PUBLIC" ? "Public" : "Friends"}</dd>
          </div>
        </dl>

        <ProfileSocialLinks profile={profile} />
      </div>
    </Card>
  );
}

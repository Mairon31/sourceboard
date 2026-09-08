import { useEffect, useState } from "react";
import type { PublicProfileDto, Relationship } from "../../../worker/profile/types";
import { Badge, Card } from "../ui";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { ConfirmAction } from "./ConfirmAction";
import { ShareAction } from "./ShareAction";
import { SocialActionButton } from "./SocialActionButton";
import { readCsrfToken } from "../../data/csrf";

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
      className={`product-profile-banner${profile.cosmetics?.profileBanner ? ` product-profile-banner--${profile.cosmetics.profileBanner}` : ""}`}
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

function relationshipLabelFor(relationship: Relationship) {
  return relationshipLabel[relationship];
}

function RelationshipAction({
  profile,
  isOwnProfile,
  relationship,
  onRelationshipChange,
}: ProfileHeroProps & {
  relationship: Relationship;
  onRelationshipChange: (relationship: Relationship) => void;
}) {
  if (isOwnProfile) return null;
  if (relationship === "NONE" && profile.canRequestFriend) {
    return (
      <SocialActionButton
        endpoint={`/api/friends/${encodeURIComponent(profile.id)}/request`}
        method="POST"
        variant="secondary"
        onSuccess={() => onRelationshipChange("OUTGOING")}
        successLabel="Request sent"
      >
        Send friend request
      </SocialActionButton>
    );
  }
  if (relationship === "INCOMING" && profile.canAcceptFriend) {
    return (
      <SocialActionButton
        endpoint={`/api/friends/${encodeURIComponent(profile.id)}/accept`}
        method="POST"
        variant="secondary"
        onSuccess={() => onRelationshipChange("FRIEND")}
        successLabel="Friends"
      >
        Accept request
      </SocialActionButton>
    );
  }
  if (relationship === "OUTGOING" && (profile.canCancelFriend || profile.canRequestFriend)) {
    return (
      <SocialActionButton
        endpoint={`/api/friends/${encodeURIComponent(profile.id)}/cancel`}
        method="POST"
        onSuccess={() => onRelationshipChange("NONE")}
        successLabel="Request cancelled"
      >
        Cancel request
      </SocialActionButton>
    );
  }
  if (relationship === "FRIEND" && (profile.canRemoveFriend || profile.canAcceptFriend)) {
    return (
      <ConfirmAction
        title="Remove friend?"
        description={`Remove ${profile.displayName} from your friends. Friends-only access will end immediately.`}
        triggerLabel="Remove friend"
        confirmLabel="Remove friend"
        destructive
        onConfirm={async () => {
          const response = await fetch(`/api/friends/${encodeURIComponent(profile.id)}`, {
            method: "DELETE",
            headers: { "x-csrf-token": readCsrfToken() },
          });
          if (!response.ok) throw new Error("Could not remove this friend.");
          onRelationshipChange("NONE");
        }}
      />
    );
  }
  return null;
}

function BlockAction({
  profile,
  relationship,
  onRelationshipChange,
}: {
  profile: PublicProfileDto;
  relationship: Relationship;
  onRelationshipChange: (relationship: Relationship) => void;
}) {
  if (!profile.canBlock || relationship === "BLOCKED") return null;
  return (
    <ConfirmAction
      title="Block this account?"
      description={`${profile.displayName} will not be able to interact with you or view content that your privacy settings protect.`}
      triggerLabel="Block"
      confirmLabel="Block account"
      destructive
      onConfirm={async () => {
        const response = await fetch(`/api/users/${encodeURIComponent(profile.id)}/block`, {
          method: "POST",
          headers: { "x-csrf-token": readCsrfToken() },
        });
        if (!response.ok) throw new Error("Could not block this account.");
        onRelationshipChange("BLOCKED");
      }}
    />
  );
}

export function ProfileHero({ profile, isOwnProfile }: ProfileHeroProps) {
  const [relationship, setRelationship] = useState<Relationship>(profile.relationship);
  useEffect(() => {
    setRelationship(profile.relationship);
  }, [profile.relationship]);
  return (
    <Card className="product-profile-hero">
      <ProfileBanner profile={profile} />
      <div className="product-profile-content">
        <div className="product-profile-identity">
          <div className="product-list-row__identity">
            <div className="product-profile-name">
              <span className="product-eyebrow">
                {isOwnProfile ? "Your profile" : "Public profile"}
              </span>
              <CosmeticIdentity
                displayName={profile.displayName}
                avatarUrl={profile.avatarUrl}
                avatarFrame={profile.cosmetics?.avatarFrame}
                profileEffect={profile.cosmetics?.profileEffect}
                nameFont={profile.cosmetics?.nameFont}
                nameEffect={profile.cosmetics?.nameEffect}
                mode="profile"
                nameAs="h1"
              />
              <p>@{profile.username}</p>
            </div>
          </div>
          <div className="product-chip-row">
            {!isOwnProfile ? (
              <Badge tone={relationship === "BLOCKED" ? "warning" : "neutral"}>
                {relationshipLabelFor(relationship)}
              </Badge>
            ) : null}
            <RelationshipAction
              profile={profile}
              isOwnProfile={isOwnProfile}
              relationship={relationship}
              onRelationshipChange={setRelationship}
            />
            <BlockAction
              profile={profile}
              relationship={relationship}
              onRelationshipChange={setRelationship}
            />
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

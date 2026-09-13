import { useEffect, useState, type ReactNode } from "react";
import type { PublicProfileDto, Relationship } from "../../../worker/profile/types";
import {
  canonicalSocialPlatform,
  SOCIAL_PLATFORM_CATALOG,
  socialHandleFromUrl,
} from "../../../shared/profile/social-links";
import { Badge } from "../ui";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { ProfileIdentityCard } from "./ProfileIdentityCard";
import { ConfirmAction } from "./ConfirmAction";
import { ShareAction } from "./ShareAction";
import { SocialActionButton } from "./SocialActionButton";
import { SocialIcon } from "./SocialIcon";
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
  editControl?: ReactNode;
}

function ProfileSocialLinks({ profile }: { profile: PublicProfileDto }) {
  const links = profile.socialLinks
    .map((link) => {
      const platform = canonicalSocialPlatform(link.platform);
      return platform ? { ...link, platform } : null;
    })
    .filter((link): link is NonNullable<typeof link> => Boolean(link));
  if (!links.length) {
    return <small className="product-profile-social-empty">No public social profiles added.</small>;
  }
  return (
    <div className="product-social-links" aria-label="Social links">
      {links.map((link) => {
        const definition = SOCIAL_PLATFORM_CATALOG[link.platform];
        return (
          <a
            key={`${link.platform}-${link.url}`}
            className="product-social-link"
            href={link.url}
            target="_blank"
            rel="noreferrer"
          >
            <span className="product-social-link__icon">
              <SocialIcon platform={link.platform} />
            </span>
            <span className="product-social-link__copy">
              <strong>{definition.label}</strong>
              <small>{socialHandleFromUrl(link.platform, link.url)}</small>
            </span>
          </a>
        );
      })}
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

export function ProfileHero({ profile, isOwnProfile, editControl }: ProfileHeroProps) {
  const [relationship, setRelationship] = useState<Relationship>(profile.relationship);
  useEffect(() => {
    setRelationship(profile.relationship);
  }, [profile.relationship]);
  return (
    <ProfileIdentityCard
      profileTheme={profile.cosmetics?.profileTheme}
      legacyProfileBanner={profile.cosmetics?.profileBanner}
      profileEffect={profile.cosmetics?.profileEffect}
      bannerUrl={profile.bannerUrl}
      visuals={profile.cosmetics?.visuals}
      creatorPro={profile.cosmetics?.creatorPro}
      communityStyles={profile.cosmetics?.communityStyles}
    >
      <div className="product-profile-content profile-header">
        <div className="product-profile-identity">
          <div className="product-profile-name">
            <span className="product-eyebrow">
              {isOwnProfile ? "Your profile" : "Public profile"}
            </span>
            <CosmeticIdentity
              displayName={profile.displayName}
              avatarUrl={profile.avatarUrl}
              avatarFrame={profile.cosmetics?.avatarFrame}
              nameFont={profile.cosmetics?.nameFont}
              nameEffect={profile.cosmetics?.nameEffect}
              visuals={profile.cosmetics?.visuals}
              creatorPro={profile.cosmetics?.creatorPro}
              mode="profile"
              nameAs="h1"
            />
            <p>@{profile.username}</p>
          </div>
          <div className="product-chip-row product-profile-actions">
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
            {editControl}
            <ShareAction
              url={`/u/${encodeURIComponent(profile.username)}`}
              title={`${profile.displayName} on SourceBoard`}
            />
          </div>
        </div>

        {profile.bio ? <p className="product-profile-bio">{profile.bio}</p> : null}

        <div
          className="product-profile-summary product-profile-stats--compact"
          aria-label="Profile summary"
        >
          <span>
            <strong>{profile.friendCount}</strong>{" "}
            {profile.friendCount === 1 ? "friend" : "friends"}
          </span>
          <span>{profile.profileVisibility === "PUBLIC" ? "Public" : "Friends only"}</span>
        </div>

        <ProfileSocialLinks profile={profile} />
      </div>
    </ProfileIdentityCard>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import type { PublicProfileDto, Relationship } from "../../../worker/profile/types";
import {
  canonicalSocialPlatform,
  SOCIAL_PLATFORM_CATALOG,
  socialHandleFromUrl,
} from "../../../shared/profile/social-links";
import { readCsrfToken } from "../../data/csrf";
import type { MessageKey } from "../../i18n";
import { useI18n } from "../../i18n/I18nProvider";
import { Badge } from "../ui";
import { ConfirmAction } from "./ConfirmAction";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { ProfileIdentityCard } from "./ProfileIdentityCard";
import { ShareAction } from "./ShareAction";
import { SocialActionButton } from "./SocialActionButton";
import { SocialIcon } from "./SocialIcon";
import { RichText } from "./RichText";
import { renderMarkdownPreview } from "../../../shared/richtext/markdown";

const relationshipLabelKeys: Record<Relationship, MessageKey> = {
  NONE: "profile.relationship.none",
  FRIEND: "profile.relationship.friend",
  INCOMING: "profile.relationship.incoming",
  OUTGOING: "profile.relationship.outgoing",
  BLOCKED: "profile.relationship.blocked",
};

function profileBioNodes(bio: string) {
  try {
    return renderMarkdownPreview(bio);
  } catch {
    return [{ type: "paragraph" as const, children: [{ type: "text" as const, text: bio }] }];
  }
}

interface ProfileHeroProps {
  profile: PublicProfileDto;
  isOwnProfile: boolean;
  editControl?: ReactNode;
}

function ProfileSocialLinks({ profile }: { profile: PublicProfileDto }) {
  const { t } = useI18n();
  const links = profile.socialLinks
    .map((link) => {
      const platform = canonicalSocialPlatform(link.platform);
      return platform ? { ...link, platform } : null;
    })
    .filter((link): link is NonNullable<typeof link> => Boolean(link));
  if (!links.length) {
    return <small className="product-profile-social-empty">{t("profile.socialEmpty")}</small>;
  }
  return (
    <div className="product-social-links" aria-label={t("profile.socialLinksAria")}>
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

function RelationshipAction({
  profile,
  isOwnProfile,
  relationship,
  onRelationshipChange,
}: ProfileHeroProps & {
  relationship: Relationship;
  onRelationshipChange: (relationship: Relationship) => void;
}) {
  const { t } = useI18n();
  if (isOwnProfile) return null;
  if (relationship === "NONE" && profile.canRequestFriend) {
    return (
      <SocialActionButton
        endpoint={`/api/friends/${encodeURIComponent(profile.id)}/request`}
        method="POST"
        variant="secondary"
        onSuccess={() => onRelationshipChange("OUTGOING")}
        successLabel={t("profile.action.requestSent")}
      >
        {t("profile.action.sendRequest")}
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
        successLabel={t("profile.action.friends")}
      >
        {t("profile.action.acceptRequest")}
      </SocialActionButton>
    );
  }
  if (relationship === "OUTGOING" && (profile.canCancelFriend || profile.canRequestFriend)) {
    return (
      <SocialActionButton
        endpoint={`/api/friends/${encodeURIComponent(profile.id)}/cancel`}
        method="POST"
        onSuccess={() => onRelationshipChange("NONE")}
        successLabel={t("profile.action.requestCancelled")}
      >
        {t("profile.action.cancelRequest")}
      </SocialActionButton>
    );
  }
  if (relationship === "FRIEND" && (profile.canRemoveFriend || profile.canAcceptFriend)) {
    return (
      <ConfirmAction
        title={t("friends.confirm.removeTitle")}
        description={t("profile.action.removeDescription", { name: profile.displayName })}
        triggerLabel={t("profile.action.removeFriend")}
        confirmLabel={t("profile.action.removeFriend")}
        destructive
        onConfirm={async () => {
          const response = await fetch(`/api/friends/${encodeURIComponent(profile.id)}`, {
            method: "DELETE",
            headers: { "x-csrf-token": readCsrfToken() },
          });
          if (!response.ok) throw new Error(t("profile.action.removeError"));
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
  const { t } = useI18n();
  if (!profile.canBlock || relationship === "BLOCKED") return null;
  return (
    <ConfirmAction
      title={t("profile.action.blockTitle")}
      description={t("profile.action.blockDescription", { name: profile.displayName })}
      triggerLabel={t("profile.action.block")}
      confirmLabel={t("profile.action.blockAccount")}
      destructive
      onConfirm={async () => {
        const response = await fetch(`/api/users/${encodeURIComponent(profile.id)}/block`, {
          method: "POST",
          headers: { "x-csrf-token": readCsrfToken() },
        });
        if (!response.ok) throw new Error(t("profile.action.blockError"));
        onRelationshipChange("BLOCKED");
      }}
    />
  );
}

export function ProfileHero({ profile, isOwnProfile, editControl }: ProfileHeroProps) {
  const { t, tp } = useI18n();
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
              {isOwnProfile ? t("profile.ownEyebrow") : t("profile.publicEyebrow")}
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
                {t(relationshipLabelKeys[relationship])}
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
              title={t("profile.shareTitle", { name: profile.displayName })}
            />
          </div>
        </div>

        {profile.bio ? (
          <RichText
            className="product-profile-bio"
            nodes={profile.bioRichtext ?? profileBioNodes(profile.bio)}
          />
        ) : null}

        <div
          className="product-profile-summary product-profile-stats--compact"
          aria-label={t("profile.summaryAria")}
        >
          <span>{tp("profile.friendCount", profile.friendCount)}</span>
          <span>
            {profile.profileVisibility === "PUBLIC"
              ? t("profile.visibility.public")
              : t("profile.visibility.friendsOnly")}
          </span>
        </div>

        <ProfileSocialLinks profile={profile} />
      </div>
    </ProfileIdentityCard>
  );
}

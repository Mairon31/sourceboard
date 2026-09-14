import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useRevalidator } from "react-router";
import { prepareImageForUpload } from "../../data/media-preparation";
import {
  canonicalSocialPlatform,
  normalizeSocialUrl,
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_CATALOG,
  socialHandleFromUrl,
  type SocialPlatform,
} from "../../../shared/profile/social-links";
import type { PublicProfileDto } from "../../../worker/profile/types";
import type { UsernameChangeStatus } from "../../../worker/profile/username-policy";
import { renderMarkdownPreview } from "../../../shared/richtext/markdown";
import type { MessageKey } from "../../i18n";
import { useI18n } from "../../i18n/I18nProvider";
import { Button, Card, Checkbox, Input, Textarea } from "../ui";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { ProfileHero } from "./ProfileHero";
import { ProfileIdentityCard } from "./ProfileIdentityCard";
import { RichText } from "./RichText";
import { SocialIcon } from "./SocialIcon";

type ProfileVisibility = "PUBLIC" | "FRIENDS_ONLY";
type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;
type TranslatePlural = (
  baseKey: string,
  count: number,
  vars?: Record<string, string | number>,
) => string;

type MyProfileResponse = {
  profile: {
    displayName: string;
    bio: string;
    profileVisibility: ProfileVisibility;
    avatarAssetId: string | null;
    bannerAssetId: string | null;
  };
  socialLinks: Array<{
    id: string;
    platform: string;
    url: string;
    sortOrder: number;
    isVisible: boolean;
  }>;
};

type UsernameResponse = { username: UsernameChangeStatus };

type SocialLinkDraft = {
  key: string;
  platform: SocialPlatform;
  url: string;
  isVisible: boolean;
};

type ProfileDraft = {
  displayName: string;
  bio: string;
  profileVisibility: ProfileVisibility;
  socialLinks: SocialLinkDraft[];
};

function readCookie(name: string): string | undefined {
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message || fallback;
  } catch {
    return fallback;
  }
}

function editorSocialValue(platform: SocialPlatform, url: string): string {
  if (platform === "website" || platform === "discord") return url;
  return socialHandleFromUrl(platform, url);
}

function createDraft(data: MyProfileResponse): ProfileDraft {
  return {
    displayName: data.profile.displayName,
    bio: data.profile.bio,
    profileVisibility: data.profile.profileVisibility,
    socialLinks: data.socialLinks
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .flatMap((link) => {
        const platform = canonicalSocialPlatform(link.platform);
        return platform
          ? [
              {
                key: link.id,
                platform,
                url: editorSocialValue(platform, link.url),
                isVisible: link.isVisible,
              },
            ]
          : [];
      }),
  };
}

function normalizeSocialLinks(links: SocialLinkDraft[], t: Translate) {
  const seen = new Set<SocialPlatform>();
  return links.flatMap((link, index) => {
    const value = link.url.trim();
    if (!value) return [];
    const platformLabel = SOCIAL_PLATFORM_CATALOG[link.platform].label;
    if (seen.has(link.platform)) {
      throw new Error(t("profileEditor.socialDuplicate", { platform: platformLabel }));
    }
    const url = normalizeSocialUrl(link.platform, value);
    if (!url) {
      throw new Error(t("profileEditor.socialInvalid", { platform: platformLabel }));
    }
    seen.add(link.platform);
    return [
      {
        platform: link.platform,
        url,
        sortOrder: index,
        isVisible: link.isVisible,
      },
    ];
  });
}

async function uploadProfileMedia(
  purpose: "AVATAR" | "BANNER",
  file: File,
  csrfToken: string,
  t: Translate,
): Promise<string> {
  const formData = new FormData();
  formData.set("purpose", purpose);
  formData.set("file", file);
  const response = await fetch("/api/profile/media", {
    method: "POST",
    headers: { "x-csrf-token": csrfToken },
    body: formData,
  });
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(
        response,
        t("profileEditor.uploadError", { purpose: purpose.toLowerCase() }),
      ),
    );
  }
  const result = (await response.json()) as { assetId: string };
  return result.assetId;
}

function validateImage(file: File | null, purpose: "AVATAR" | "BANNER", t: Translate): void {
  if (!file) return;
  const maxBytes = purpose === "BANNER" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(
      t(purpose === "BANNER" ? "profileEditor.bannerImageSize" : "profileEditor.imageSize"),
    );
  }
  if (!["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"].includes(file.type)) {
    throw new Error(t("profileEditor.imageType"));
  }
}

function validateUsername(username: string, t: Translate): void {
  if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) {
    throw new Error(t("profileEditor.usernameInvalid"));
  }
}

function useObjectUrl(file: File | null): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!file) {
      setUrl(undefined);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function draftFingerprint(draft: ProfileDraft | null): string {
  return draft ? JSON.stringify(draft) : "";
}

function socialPreview(link: SocialLinkDraft): string {
  const value = link.url.trim();
  if (!value) return SOCIAL_PLATFORM_CATALOG[link.platform].placeholder;
  const normalized = normalizeSocialUrl(link.platform, value);
  return normalized ? socialHandleFromUrl(link.platform, normalized) : value;
}

function bioPreviewNodes(value: string) {
  try {
    return renderMarkdownPreview(value);
  } catch {
    return [{ type: "paragraph" as const, children: [{ type: "text" as const, text: value }] }];
  }
}

function usernamePolicyMessage(
  status: UsernameChangeStatus,
  t: Translate,
  tp: TranslatePlural,
  formatDate: (value: Date | number, options?: Intl.DateTimeFormatOptions) => string,
): string {
  const remaining = tp("profileEditor.usernameChanges", status.remainingChanges);
  if (status.canChange) {
    return t("profileEditor.usernameWindow", { remaining, days: status.windowDays });
  }
  if (status.nextChangeAt) {
    return t("profileEditor.usernameNext", {
      remaining,
      date: formatDate(new Date(status.nextChangeAt), { dateStyle: "medium", timeStyle: "short" }),
    });
  }
  return t("profileEditor.usernameLimit", { days: status.windowDays });
}

export function ProfileEditor({
  profile,
  onEditingChange,
}: {
  profile: PublicProfileDto;
  onEditingChange?: (editing: boolean) => void;
}) {
  const { t, tp, date } = useI18n();
  const revalidator = useRevalidator();
  const location = useLocation();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState<MyProfileResponse | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [initialFingerprint, setInitialFingerprint] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameChangeStatus | null>(null);
  const [usernameSettingsUnavailable, setUsernameSettingsUnavailable] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(profile.username);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [preparingMedia, setPreparingMedia] = useState(false);
  const [bioMode, setBioMode] = useState<"write" | "preview">("write");
  const bioRef = useRef<HTMLTextAreaElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const avatarPreview = useObjectUrl(avatarFile);
  const bannerPreview = useObjectUrl(bannerFile);
  const profileDirty = Boolean(
    draft &&
    (draftFingerprint(draft) !== initialFingerprint || avatarFile !== null || bannerFile !== null),
  );
  const usernameDirty = Boolean(usernameStatus && usernameDraft.trim() !== usernameStatus.username);
  const dirty = profileDirty || usernameDirty;

  useEffect(() => {
    if (!editing || draft) return;
    let cancelled = false;
    setStatus(null);
    setUsernameSettingsUnavailable(false);
    void Promise.allSettled([
      fetch("/api/profile/me", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, t("profileEditor.loadProfileError")));
        }
        return (await response.json()) as MyProfileResponse;
      }),
      fetch("/api/profile/me/username", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, t("profileEditor.loadUsernameError")));
        }
        return (await response.json()) as UsernameResponse;
      }),
    ]).then(([profileResult, usernameResult]) => {
      if (cancelled) return;
      if (profileResult.status === "rejected") {
        setStatus(
          profileResult.reason instanceof Error
            ? profileResult.reason.message
            : t("profileEditor.loadProfileError"),
        );
        return;
      }

      const data = profileResult.value;
      const nextDraft = createDraft(data);
      setSource(data);
      setDraft(nextDraft);
      setInitialFingerprint(draftFingerprint(nextDraft));

      if (usernameResult.status === "fulfilled") {
        setUsernameStatus(usernameResult.value.username);
        setUsernameDraft(usernameResult.value.username.username);
        setUsernameSettingsUnavailable(false);
      } else {
        setUsernameStatus(null);
        setUsernameDraft(profile.username);
        setUsernameSettingsUnavailable(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [draft, editing, profile.username, t]);

  const availablePlatforms = useMemo(() => {
    const selected = new Set(draft?.socialLinks.map((link) => link.platform) ?? []);
    return SOCIAL_PLATFORMS.filter((platform) => !selected.has(platform));
  }, [draft?.socialLinks]);

  function beginEditing() {
    setBioMode("write");
    setEditing(true);
    onEditingChange?.(true);
  }

  function cancelEditing() {
    setBioMode("write");
    setEditing(false);
    onEditingChange?.(false);
    setSource(null);
    setDraft(null);
    setInitialFingerprint("");
    setUsernameStatus(null);
    setUsernameSettingsUnavailable(false);
    setUsernameDraft(profile.username);
    setAvatarFile(null);
    setBannerFile(null);
    setStatus(null);
  }

  function wrapBio(prefix: string, suffix = prefix) {
    if (!draft) return;
    const input = bioRef.current;
    const start = input?.selectionStart ?? draft.bio.length;
    const end = input?.selectionEnd ?? start;
    const selected = draft.bio.slice(start, end);
    const next = `${draft.bio.slice(0, start)}${prefix}${selected}${suffix}${draft.bio.slice(end)}`;
    setDraft((current) => (current ? { ...current, bio: next } : current));
    requestAnimationFrame(() => {
      bioRef.current?.focus();
      const cursor = selected
        ? start + prefix.length + selected.length + suffix.length
        : start + prefix.length;
      bioRef.current?.setSelectionRange(cursor, cursor);
    });
  }

  function updateLink(key: string, change: Partial<SocialLinkDraft>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            socialLinks: current.socialLinks.map((link) =>
              link.key === key ? { ...link, ...change } : link,
            ),
          }
        : current,
    );
  }

  function addLink() {
    setDraft((current) => {
      if (!current || current.socialLinks.length >= 10) return current;
      const selected = new Set(current.socialLinks.map((link) => link.platform));
      const platform = SOCIAL_PLATFORMS.find((candidate) => !selected.has(candidate));
      if (!platform) return current;
      return {
        ...current,
        socialLinks: [
          ...current.socialLinks,
          { key: `new-${crypto.randomUUID()}`, platform, url: "", isVisible: true },
        ],
      };
    });
  }

  function removeLink(key: string) {
    setDraft((current) =>
      current
        ? { ...current, socialLinks: current.socialLinks.filter((link) => link.key !== key) }
        : current,
    );
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !source || !dirty) return;
    setBusy(true);
    setStatus(null);
    try {
      const displayName = draft.displayName.trim();
      const nextUsername = usernameDraft.trim();
      if (!displayName) throw new Error(t("profileEditor.displayNameEmpty"));
      if (usernameDirty) validateUsername(nextUsername, t);
      validateImage(avatarFile, "AVATAR", t);
      validateImage(bannerFile, "BANNER", t);
      const socialLinks = normalizeSocialLinks(draft.socialLinks, t);
      const csrfToken = readCookie("__Host-sourceboard_csrf") ?? "";
      let avatarAssetId = source.profile.avatarAssetId;
      let bannerAssetId = source.profile.bannerAssetId;
      let profileSaved = false;

      if (avatarFile) avatarAssetId = await uploadProfileMedia("AVATAR", avatarFile, csrfToken, t);
      if (bannerFile) bannerAssetId = await uploadProfileMedia("BANNER", bannerFile, csrfToken, t);

      if (profileDirty) {
        const response = await fetch("/api/profile/me", {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({
            displayName,
            bio: draft.bio,
            profileVisibility: draft.profileVisibility,
            avatarAssetId,
            bannerAssetId,
            socialLinks,
          }),
        });
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, t("profileEditor.saveError")));
        }

        profileSaved = true;
        const persistedDraft = { ...draft, displayName };
        setDraft(persistedDraft);
        setInitialFingerprint(draftFingerprint(persistedDraft));
        setSource((current) =>
          current
            ? {
                ...current,
                profile: {
                  ...current.profile,
                  displayName,
                  bio: draft.bio,
                  profileVisibility: draft.profileVisibility,
                  avatarAssetId,
                  bannerAssetId,
                },
              }
            : current,
        );
        setAvatarFile(null);
        setBannerFile(null);
      }

      if (usernameDirty && usernameStatus) {
        const oldUsername = usernameStatus.username;
        const response = await fetch("/api/profile/me/username", {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ username: nextUsername }),
        });
        if (!response.ok) {
          const message = await readErrorMessage(response, t("profileEditor.usernameSaveError"));
          if (profileSaved) {
            setStatus(t("profileEditor.partialSave", { message }));
            revalidator.revalidate();
            return;
          }
          throw new Error(message);
        }

        const result = (await response.json()) as UsernameResponse;
        setUsernameStatus(result.username);
        setUsernameDraft(result.username.username);
        setEditing(false);
        onEditingChange?.(false);
        setSource(null);
        setDraft(null);
        setInitialFingerprint("");
        setAvatarFile(null);
        setBannerFile(null);
        setStatus(
          profileSaved ? t("profileEditor.bothUpdated") : t("profileEditor.usernameUpdated"),
        );
        const oldPath = `/u/${encodeURIComponent(oldUsername)}`;
        if (location.pathname === oldPath) {
          navigate(`/u/${encodeURIComponent(result.username.username)}`, { replace: true });
        } else {
          revalidator.revalidate();
        }
        return;
      }

      setEditing(false);
      onEditingChange?.(false);
      setSource(null);
      setDraft(null);
      setInitialFingerprint("");
      setAvatarFile(null);
      setBannerFile(null);
      setStatus(t("profileEditor.profileUpdated"));
      revalidator.revalidate();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("profileEditor.saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function selectProfileMedia(purpose: "AVATAR" | "BANNER", file: File | undefined) {
    if (!file) return;
    try {
      validateImage(file, purpose, t);
      setPreparingMedia(true);
      setStatus(null);
      const prepared = await prepareImageForUpload(file, {
        maxDimension: purpose === "AVATAR" ? 2_048 : 4_096,
      });
      if (purpose === "AVATAR") setAvatarFile(prepared);
      else setBannerFile(prepared);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("profileEditor.imagePrepareError"));
    } finally {
      setPreparingMedia(false);
    }
  }

  if (!editing) {
    return (
      <>
        <ProfileHero
          profile={profile}
          isOwnProfile
          editControl={
            <Button variant="secondary" size="sm" onClick={beginEditing}>
              {t("profileEditor.edit")}
            </Button>
          }
        />
        {status ? (
          <div className="product-profile-edit-status" role="status">
            {status}
          </div>
        ) : null}
      </>
    );
  }

  if (!draft) {
    return (
      <Card className="product-profile-hero product-profile-editor-inline">
        <div className="product-profile-editor-loading">
          <span className="product-eyebrow">{t("profileEditor.edit")}</span>
          <strong>{t("profileEditor.loading")}</strong>
          {status ? <span role="alert">{status}</span> : null}
          <Button variant="ghost" size="sm" onClick={cancelEditing}>
            {t("common.cancel")}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <ProfileIdentityCard
      profileTheme={profile.cosmetics?.profileTheme}
      legacyProfileBanner={profile.cosmetics?.profileBanner}
      profileEffect={profile.cosmetics?.profileEffect}
      bannerUrl={bannerPreview ?? profile.bannerUrl}
      visuals={profile.cosmetics?.visuals}
      communityStyles={profile.cosmetics?.communityStyles}
      className="product-profile-editor-inline"
    >
      <label
        className="product-profile-theme-edit"
        title={t("profileEditor.changeBackgroundTitle")}
      >
        <span>{t("profileEditor.changeBackground")}</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
          onChange={(event) => void selectProfileMedia("BANNER", event.target.files?.[0])}
        />
      </label>

      <form
        className="product-profile-content product-profile-editor-inline__form profile-header"
        onSubmit={(event) => void saveProfile(event)}
      >
        <div className="product-profile-editor-inline__identity">
          <label
            className="product-profile-avatar-edit"
            title={t("profileEditor.changeAvatarTitle")}
          >
            <CosmeticIdentity
              displayName={draft.displayName.trim() || usernameDraft.trim() || profile.username}
              avatarUrl={avatarPreview ?? profile.avatarUrl}
              avatarFrame={profile.cosmetics?.avatarFrame}
              nameFont={profile.cosmetics?.nameFont}
              nameEffect={profile.cosmetics?.nameEffect}
              visuals={profile.cosmetics?.visuals}
              mode="profile"
              nameAs="h1"
            />
            <span>{t("profileEditor.change")}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
              onChange={(event) => void selectProfileMedia("AVATAR", event.target.files?.[0])}
            />
          </label>
          <div className="product-profile-editor-inline__identity-copy">
            <strong>{draft.displayName.trim() || usernameDraft.trim() || profile.username}</strong>
            <span>@{usernameDraft.trim() || profile.username}</span>
            <small>{t("profileEditor.imageHint")}</small>
          </div>
        </div>

        <div className="product-profile-editor-inline__toolbar">
          <div>
            <span className="product-eyebrow">{t("profileEditor.edit")}</span>
            <strong>{dirty ? t("profileEditor.unsaved") : t("profileEditor.preview")}</strong>
            {preparingMedia ? (
              <small role="status">{t("profileEditor.imagePreparing")}</small>
            ) : null}
          </div>
          <div className="product-chip-row">
            <Button type="submit" size="sm" loading={busy} disabled={!dirty || preparingMedia}>
              {t("common.save")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || preparingMedia}
              onClick={cancelEditing}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>

        <div className="product-profile-editor-inline__fields">
          <div className="product-profile-editor-inline__username">
            <Input
              label={t("profileEditor.username")}
              value={usernameDraft}
              maxLength={32}
              disabled={busy || usernameSettingsUnavailable || !usernameStatus?.canChange}
              onChange={(event) => setUsernameDraft(event.target.value)}
            />
            <small className="product-profile-editor-inline__username-policy">
              {usernameSettingsUnavailable
                ? t("profileEditor.usernameUnavailable")
                : usernameStatus
                  ? usernamePolicyMessage(usernameStatus, t, tp, date)
                  : t("profileEditor.usernameLoading")}
            </small>
          </div>
          <Input
            label={t("profileEditor.displayName")}
            value={draft.displayName}
            maxLength={80}
            onChange={(event) =>
              setDraft((current) =>
                current ? { ...current, displayName: event.target.value } : current,
              )
            }
          />
          <div className="product-profile-editor-inline__bio">
            <div className="product-profile-editor-inline__bio-heading">
              <span className="sb-field__label">{t("profileEditor.bio")}</span>
              <div className="product-chip-row" role="tablist" aria-label={t("profileEditor.bio")}>
                <Button
                  type="button"
                  size="sm"
                  variant={bioMode === "write" ? "secondary" : "ghost"}
                  role="tab"
                  aria-selected={bioMode === "write"}
                  onClick={() => setBioMode("write")}
                >
                  {t("profileEditor.bioWrite")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={bioMode === "preview" ? "secondary" : "ghost"}
                  role="tab"
                  aria-selected={bioMode === "preview"}
                  onClick={() => setBioMode("preview")}
                >
                  {t("profileEditor.bioPreview")}
                </Button>
              </div>
            </div>
            {bioMode === "write" ? (
              <>
                <div
                  className="product-profile-editor-inline__bio-toolbar"
                  role="toolbar"
                  aria-label={t("profileEditor.bio")}
                >
                  <button
                    type="button"
                    onClick={() => wrapBio("**")}
                    aria-label={t("profileEditor.bioBold")}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => wrapBio("*")}
                    aria-label={t("profileEditor.bioItalic")}
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => wrapBio("> ", "")}
                    aria-label={t("profileEditor.bioQuote")}
                  >
                    ❯
                  </button>
                  <button
                    type="button"
                    onClick={() => wrapBio("`")}
                    aria-label={t("profileEditor.bioCode")}
                  >
                    &lt;/&gt;
                  </button>
                </div>
                <Textarea
                  ref={bioRef}
                  label={t("profileEditor.bio")}
                  value={draft.bio}
                  maxLength={5000}
                  rows={4}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, bio: event.target.value } : current,
                    )
                  }
                />
              </>
            ) : (
              <div className="product-profile-editor-inline__bio-preview" role="tabpanel">
                {draft.bio.trim() ? (
                  <RichText nodes={bioPreviewNodes(draft.bio)} />
                ) : (
                  <span>{t("profileEditor.bioEmpty")}</span>
                )}
              </div>
            )}
            <small>{t("profileEditor.bioHint")}</small>
          </div>
          <label className="product-field-native">
            <span>{t("profileEditor.visibility")}</span>
            <select
              value={draft.profileVisibility}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? { ...current, profileVisibility: event.target.value as ProfileVisibility }
                    : current,
                )
              }
            >
              <option value="PUBLIC">{t("profileEditor.visibility.public")}</option>
              <option value="FRIENDS_ONLY">{t("profileEditor.visibility.friends")}</option>
            </select>
          </label>
        </div>

        <section className="product-profile-editor-socials">
          <div className="product-section-heading product-profile-editor-socials__heading">
            <div>
              <span className="product-eyebrow">{t("profileEditor.social.eyebrow")}</span>
              <h2>{t("profileEditor.social.title")}</h2>
              <p>{t("profileEditor.social.description")}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!availablePlatforms.length || draft.socialLinks.length >= 10}
              onClick={addLink}
            >
              {t("profileEditor.social.add")}
            </Button>
          </div>

          <div className="product-profile-editor-social-list">
            {draft.socialLinks.map((link) => {
              const definition = SOCIAL_PLATFORM_CATALOG[link.platform];
              const otherSelected = new Set(
                draft.socialLinks
                  .filter((candidate) => candidate.key !== link.key)
                  .map((candidate) => candidate.platform),
              );
              return (
                <div className="product-profile-editor-social" key={link.key}>
                  <div className="product-profile-editor-social__identity">
                    <span className="product-profile-editor-social__icon">
                      <SocialIcon platform={link.platform} />
                    </span>
                    <span>
                      <strong>{definition.label}</strong>
                      <small>{socialPreview(link)}</small>
                    </span>
                  </div>
                  <label className="product-field-native product-profile-editor-social__platform">
                    <span>{t("profileEditor.social.platform")}</span>
                    <select
                      value={link.platform}
                      onChange={(event) =>
                        updateLink(link.key, { platform: event.target.value as SocialPlatform })
                      }
                    >
                      {SOCIAL_PLATFORMS.filter(
                        (platform) => platform === link.platform || !otherSelected.has(platform),
                      ).map((platform) => (
                        <option key={platform} value={platform}>
                          {SOCIAL_PLATFORM_CATALOG[platform].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Input
                    label={t("profileEditor.social.value")}
                    value={link.url}
                    maxLength={2048}
                    placeholder={definition.placeholder}
                    onChange={(event) => updateLink(link.key, { url: event.target.value })}
                  />
                  <div className="product-profile-editor-social__actions">
                    <Checkbox
                      label={t("profileEditor.social.visible")}
                      checked={link.isVisible}
                      onCheckedChange={(checked) =>
                        updateLink(link.key, { isVisible: checked === true })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLink(link.key)}
                    >
                      {t("profileEditor.social.remove")}
                    </Button>
                  </div>
                </div>
              );
            })}
            {!draft.socialLinks.length ? (
              <div className="product-empty-state product-empty-state--compact">
                <p>{t("profileEditor.social.empty")}</p>
              </div>
            ) : null}
          </div>
        </section>

        {status ? (
          <div className="product-profile-edit-status" role="alert">
            {status}
          </div>
        ) : null}
      </form>
    </ProfileIdentityCard>
  );
}

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { useRevalidator } from "react-router";
import type { PublicProfileDto } from "../../../worker/profile/types";
import {
  canonicalSocialPlatform,
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_CATALOG,
  type SocialPlatform,
} from "../../../shared/profile/social-links";
import { Button, Card, Checkbox, Input, Textarea } from "../ui";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { ProfileHero } from "./ProfileHero";
import { SocialIcon } from "./SocialIcon";
import { cosmeticVisualClass, cosmeticVisualStyle } from "./cosmetic-visual";

type ProfileVisibility = "PUBLIC" | "FRIENDS_ONLY";

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
                url: link.url,
                isVisible: link.isVisible,
              },
            ]
          : [];
      }),
  };
}

function normalizeSocialLinks(links: SocialLinkDraft[]) {
  const seen = new Set<SocialPlatform>();
  return links.flatMap((link, index) => {
    const url = link.url.trim();
    if (!url) return [];
    if (seen.has(link.platform)) {
      throw new Error(`Only one ${SOCIAL_PLATFORM_CATALOG[link.platform].label} link is allowed.`);
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
      await readErrorMessage(response, `Could not upload the ${purpose.toLowerCase()}.`),
    );
  }
  const result = (await response.json()) as { assetId: string };
  return result.assetId;
}

function validateImage(file: File | null): void {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) throw new Error("Profile images must be 5 MB or smaller.");
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
    throw new Error("Use a PNG, JPEG, WebP or GIF image.");
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

export function ProfileEditor({ profile }: { profile: PublicProfileDto }) {
  const revalidator = useRevalidator();
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState<MyProfileResponse | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [initialFingerprint, setInitialFingerprint] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const avatarPreview = useObjectUrl(avatarFile);
  const bannerPreview = useObjectUrl(bannerFile);
  const dirty = Boolean(
    draft &&
      (draftFingerprint(draft) !== initialFingerprint || avatarFile !== null || bannerFile !== null),
  );

  useEffect(() => {
    if (!editing || draft) return;
    let cancelled = false;
    setStatus(null);
    void fetch("/api/profile/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, "Could not load your profile."));
        }
        return (await response.json()) as MyProfileResponse;
      })
      .then((data) => {
        if (cancelled) return;
        const nextDraft = createDraft(data);
        setSource(data);
        setDraft(nextDraft);
        setInitialFingerprint(draftFingerprint(nextDraft));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Could not load your profile.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [draft, editing]);

  const availablePlatforms = useMemo(() => {
    const selected = new Set(draft?.socialLinks.map((link) => link.platform) ?? []);
    return SOCIAL_PLATFORMS.filter((platform) => !selected.has(platform));
  }, [draft?.socialLinks]);

  function cancelEditing() {
    setEditing(false);
    setSource(null);
    setDraft(null);
    setInitialFingerprint("");
    setAvatarFile(null);
    setBannerFile(null);
    setStatus(null);
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
          {
            key: `new-${crypto.randomUUID()}`,
            platform,
            url: "",
            isVisible: true,
          },
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
      if (!displayName) throw new Error("Display name cannot be empty.");
      validateImage(avatarFile);
      validateImage(bannerFile);
      const csrfToken = readCookie("__Host-sourceboard_csrf") ?? "";
      let avatarAssetId = source.profile.avatarAssetId;
      let bannerAssetId = source.profile.bannerAssetId;
      if (avatarFile) avatarAssetId = await uploadProfileMedia("AVATAR", avatarFile, csrfToken);
      if (bannerFile) bannerAssetId = await uploadProfileMedia("BANNER", bannerFile, csrfToken);
      const response = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          displayName,
          bio: draft.bio,
          profileVisibility: draft.profileVisibility,
          avatarAssetId,
          bannerAssetId,
          socialLinks: normalizeSocialLinks(draft.socialLinks),
        }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Could not save your profile."));
      }
      setEditing(false);
      setSource(null);
      setDraft(null);
      setInitialFingerprint("");
      setAvatarFile(null);
      setBannerFile(null);
      setStatus("Profile updated.");
      revalidator.revalidate();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <>
        <ProfileHero
          profile={profile}
          isOwnProfile
          editControl={
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Edit profile
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
          <span className="product-eyebrow">Edit profile</span>
          <strong>Loading your profile…</strong>
          {status ? <span role="alert">{status}</span> : null}
          <Button variant="ghost" size="sm" onClick={cancelEditing}>
            Cancel
          </Button>
        </div>
      </Card>
    );
  }

  const bannerVisual = profile.cosmetics?.visuals?.profileBanner;
  const bannerStyle: CSSProperties = {
    ...(cosmeticVisualStyle(bannerVisual) ?? {}),
    backgroundImage: bannerPreview
      ? `url("${bannerPreview}")`
      : profile.bannerUrl
        ? `url("${profile.bannerUrl}")`
        : undefined,
  };

  return (
    <Card className="product-profile-hero product-profile-editor-inline">
      <div
        className={`product-profile-banner${profile.cosmetics?.profileBanner ? ` product-profile-banner--${profile.cosmetics.profileBanner}` : ""}${cosmeticVisualClass(bannerVisual)}`}
        style={bannerStyle}
        aria-label="Profile banner preview"
      >
        <label className="product-profile-media-edit">
          <span>Change banner</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => setBannerFile(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <form
        className="product-profile-content product-profile-editor-inline__form"
        onSubmit={(event) => void saveProfile(event)}
      >
        <div className="product-profile-editor-inline__toolbar">
          <div>
            <span className="product-eyebrow">Edit profile</span>
            <strong>{dirty ? "Unsaved changes" : "Profile preview"}</strong>
          </div>
          <div className="product-chip-row">
            <Button type="submit" size="sm" loading={busy} disabled={!dirty}>
              Save
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={cancelEditing}>
              Cancel
            </Button>
          </div>
        </div>

        <div className="product-profile-editor-inline__identity">
          <label className="product-profile-avatar-edit">
            <CosmeticIdentity
              displayName={draft.displayName.trim() || profile.username}
              avatarUrl={avatarPreview ?? profile.avatarUrl}
              avatarFrame={profile.cosmetics?.avatarFrame}
              profileEffect={profile.cosmetics?.profileEffect}
              nameFont={profile.cosmetics?.nameFont}
              nameEffect={profile.cosmetics?.nameEffect}
              visuals={profile.cosmetics?.visuals}
              mode="profile"
              nameAs="h1"
            />
            <span>Change avatar</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <span className="product-profile-editor-inline__username">@{profile.username}</span>
        </div>

        <div className="product-profile-editor-inline__fields">
          <Input
            label="Display name"
            value={draft.displayName}
            maxLength={80}
            onChange={(event) =>
              setDraft((current) =>
                current ? { ...current, displayName: event.target.value } : current,
              )
            }
          />
          <Textarea
            label="Bio"
            value={draft.bio}
            maxLength={5000}
            rows={4}
            onChange={(event) =>
              setDraft((current) => (current ? { ...current, bio: event.target.value } : current))
            }
          />
          <label className="product-field-native">
            <span>Profile visibility</span>
            <select
              value={draft.profileVisibility}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        profileVisibility: event.target.value as ProfileVisibility,
                      }
                    : current,
                )
              }
            >
              <option value="PUBLIC">Public</option>
              <option value="FRIENDS_ONLY">Friends only</option>
            </select>
          </label>
        </div>

        <section className="product-profile-editor-socials">
          <div className="product-section-heading">
            <div>
              <span className="product-eyebrow">Social links</span>
              <h2>Profiles people can recognize</h2>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!availablePlatforms.length || draft.socialLinks.length >= 10}
              onClick={addLink}
            >
              Add link
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
                  <span className="product-profile-editor-social__icon">
                    <SocialIcon platform={link.platform} />
                  </span>
                  <label className="product-field-native">
                    <span>Platform</span>
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
                    label={definition.inputLabel}
                    value={link.url}
                    maxLength={2048}
                    placeholder={definition.placeholder}
                    onChange={(event) => updateLink(link.key, { url: event.target.value })}
                  />
                  <Checkbox
                    label="Visible"
                    checked={link.isVisible}
                    onCheckedChange={(checked) =>
                      updateLink(link.key, { isVisible: checked === true })
                    }
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeLink(link.key)}>
                    Remove
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        {status ? (
          <div className="product-profile-edit-status" role="alert">
            {status}
          </div>
        ) : null}
      </form>
    </Card>
  );
}

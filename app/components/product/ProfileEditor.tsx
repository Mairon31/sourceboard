import { useEffect, useState, type FormEvent } from "react";
import { useRevalidator } from "react-router";
import { Button, Card, Checkbox, Input, Textarea } from "../ui";

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
  platform: string;
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
      .map((link) => ({
        key: link.id,
        platform: link.platform,
        url: link.url,
        isVisible: link.isVisible,
      })),
  };
}

function normalizeSocialLinks(links: SocialLinkDraft[]) {
  return links.flatMap((link, index) => {
    const platform = link.platform.trim();
    const url = link.url.trim();
    if (!platform && !url) return [];
    if (!platform || !url) throw new Error("Each social link needs a platform and URL.");
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Social links must use http:// or https:// URLs.");
    }
    return [{ platform, url, sortOrder: index, isVisible: link.isVisible }];
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
    throw new Error(await readErrorMessage(response, `Could not upload the ${purpose.toLowerCase()}.`));
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

export function ProfileEditor() {
  const revalidator = useRevalidator();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<MyProfileResponse | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open || draft) return;
    let cancelled = false;
    setStatus(null);
    void fetch("/api/profile/me")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, "Could not load your profile."));
        }
        return (await response.json()) as MyProfileResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setSource(data);
        setDraft(createDraft(data));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Could not load your profile.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [draft, open]);

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
    setDraft((current) =>
      current && current.socialLinks.length < 8
        ? {
            ...current,
            socialLinks: [
              ...current.socialLinks,
              {
                key: `new-${Date.now()}-${current.socialLinks.length}`,
                platform: "",
                url: "",
                isVisible: true,
              },
            ],
          }
        : current,
    );
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
    if (!draft || !source) return;
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
      setStatus("Profile updated.");
      setOpen(false);
      setSource(null);
      setDraft(null);
      setAvatarFile(null);
      setBannerFile(null);
      revalidator.revalidate();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save your profile.");
      revalidator.revalidate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="product-settings-section">
      <span className="product-eyebrow">Your profile</span>
      <h2>Edit profile</h2>
      <p>Update how your profile appears to the SourceBoard community.</p>
      <div className="product-chip-row">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setOpen((current) => !current);
            setStatus(null);
          }}
        >
          {open ? "Close editor" : "Edit profile"}
        </Button>
      </div>
      {status ? <span role="status">{status}</span> : null}
      {open && !draft ? <span className="product-store-preview-status">Loading profile…</span> : null}
      {open && draft ? (
        <form className="product-form-grid" onSubmit={(event) => void saveProfile(event)}>
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
            rows={5}
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
          <Input
            label="Avatar"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hint="PNG, JPEG, WebP or GIF. Maximum 5 MB."
            onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
          />
          <Input
            label="Banner"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hint="PNG, JPEG, WebP or GIF. Maximum 5 MB."
            onChange={(event) => setBannerFile(event.target.files?.[0] ?? null)}
          />

          <div className="product-section-heading">
            <div>
              <span className="product-eyebrow">Links</span>
              <h2>Social links</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={draft.socialLinks.length >= 8}
              onClick={addLink}
            >
              Add link
            </Button>
          </div>

          <div className="product-list">
            {draft.socialLinks.map((link) => (
              <Card className="product-form-card" key={link.key}>
                <Input
                  label="Platform"
                  value={link.platform}
                  maxLength={32}
                  placeholder="Instagram"
                  onChange={(event) => updateLink(link.key, { platform: event.target.value })}
                />
                <Input
                  label="URL"
                  type="url"
                  value={link.url}
                  maxLength={2048}
                  placeholder="https://example.com/you"
                  onChange={(event) => updateLink(link.key, { url: event.target.value })}
                />
                <Checkbox
                  label="Visible on profile"
                  checked={link.isVisible}
                  onCheckedChange={(checked) =>
                    updateLink(link.key, { isVisible: checked === true })
                  }
                />
                <Button variant="ghost" size="sm" onClick={() => removeLink(link.key)}>
                  Remove link
                </Button>
              </Card>
            ))}
          </div>

          <div className="product-chip-row">
            <Button type="submit" loading={busy}>
              Save profile
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setSource(null);
                setDraft(null);
                setAvatarFile(null);
                setBannerFile(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}

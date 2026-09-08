import { useState } from "react";
import { useNavigate } from "react-router";
import type { CosmeticIdentityProps } from "./CosmeticIdentity";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { ImageUploadField } from "./ImageUploadField";
import { readCsrfToken } from "../../data/csrf";
import { Button, Card, Input, Switch, Textarea } from "../ui";
import "./post-composer.css";

export interface PostComposerIdentity {
  displayName: string;
  avatarUrl?: string;
  cosmetics: Pick<CosmeticIdentityProps, "avatarFrame" | "profileEffect" | "nameFont">;
}

type PostVisibility = "PUBLIC" | "FRIENDS_ONLY" | "UNLISTED" | "PRIVATE";

interface PostComposerProps {
  identity: PostComposerIdentity | null;
  unavailable?: boolean;
}

export function PostComposer({ identity, unavailable = false }: PostComposerProps) {
  const navigate = useNavigate();
  const [authorMode, setAuthorMode] = useState<"IDENTIFIED" | "ANONYMOUS">("IDENTIFIED");
  const [visibility, setVisibility] = useState<PostVisibility>("PUBLIC");
  const [isNsfw, setIsNsfw] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!imageFile) {
      setStatus("Add the main image before publishing.");
      return;
    }

    setBusy(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    form.set("file", imageFile, imageFile.name);
    form.set("authorMode", authorMode);
    form.set("visibility", visibility);
    form.set("isNsfw", String(isNsfw));

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "x-csrf-token": readCsrfToken() },
        body: form,
      });
      const body = (await response.json().catch(() => null)) as {
        post?: { id: string; slug?: string };
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.post) {
        setStatus(body?.error?.message ?? "The source request could not be published.");
        return;
      }

      const postPath = `/posts/${encodeURIComponent(body.post.id)}`;
      const destination = body.post.slug
        ? `${postPath}/${encodeURIComponent(body.post.slug)}`
        : postPath;
      navigate(destination, { replace: true });
    } catch {
      setStatus("The source request could not be published. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function setAnonymous(checked: boolean) {
    if (checked && visibility === "FRIENDS_ONLY") setVisibility("PUBLIC");
    setAuthorMode(checked ? "ANONYMOUS" : "IDENTIFIED");
  }

  return (
    <Card className="product-form-card product-post-composer">
      <form
        className="product-form-grid product-post-composer__form"
        onSubmit={(event) => void submit(event)}
      >
        <section className="product-post-composer__section" aria-labelledby="post-image-heading">
          <div className="product-post-composer__section-heading">
            <div>
              <span className="product-post-composer__step">1</span>
              <h2 id="post-image-heading">Add the image</h2>
            </div>
            <p>Use the clearest version you have. You can replace it before publishing.</p>
          </div>
          <ImageUploadField
            file={imageFile}
            onFileChange={setImageFile}
            disabled={unavailable}
            uploading={busy}
          />
        </section>

        <section className="product-post-composer__section" aria-labelledby="post-context-heading">
          <div className="product-post-composer__section-heading">
            <div>
              <span className="product-post-composer__step">2</span>
              <h2 id="post-context-heading">Add context</h2>
            </div>
            <p>Describe what you know so people can trace the source faster.</p>
          </div>
          <Input
            label="Title"
            name="title"
            placeholder="Where did this image originally come from?"
            maxLength={160}
            required
            disabled={unavailable || busy}
          />
          <Textarea
            label="Description"
            name="description"
            placeholder="Where you found it, what you already tried, and what kind of source you need…"
            maxLength={10_000}
            disabled={unavailable || busy}
          />
        </section>

        <section className="product-post-composer__section" aria-labelledby="post-audience-heading">
          <div className="product-post-composer__section-heading">
            <div>
              <span className="product-post-composer__step">3</span>
              <h2 id="post-audience-heading">Choose the audience</h2>
            </div>
            <p>Control who can find the request and how your identity appears.</p>
          </div>

          <label className="product-field-native">
            <span>Visibility</span>
            <select
              name="visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.currentTarget.value as PostVisibility)}
              aria-label="Visibility"
              disabled={unavailable || busy}
            >
              <option value="PUBLIC">Public</option>
              <option value="FRIENDS_ONLY" disabled={authorMode === "ANONYMOUS"}>
                Friends only
              </option>
              <option value="UNLISTED">Unlisted</option>
              <option value="PRIVATE">Private</option>
            </select>
          </label>

          <Switch
            label="Post anonymously"
            description="People see Anonymous Author instead of your profile."
            checked={authorMode === "ANONYMOUS"}
            disabled={unavailable || busy}
            onCheckedChange={setAnonymous}
          />

          <div className="product-presentation-notice" role="note" aria-label="Author preview">
            <strong>Author preview</strong>
            {authorMode === "ANONYMOUS" ? (
              <span>Anonymous Author</span>
            ) : identity ? (
              <CosmeticIdentity
                displayName={identity.displayName}
                avatarUrl={identity.avatarUrl}
                avatarFrame={identity.cosmetics.avatarFrame}
                profileEffect={identity.cosmetics.profileEffect}
                nameFont={identity.cosmetics.nameFont}
                mode="preview"
                nameAs="strong"
              />
            ) : (
              <span>SourceBoard member</span>
            )}
          </div>

          <Switch
            label="Mark as NSFW"
            description="Use this when the image contains sensitive or adult material."
            checked={isNsfw}
            disabled={unavailable || busy}
            onCheckedChange={setIsNsfw}
          />
        </section>

        {unavailable ? (
          <div className="product-post-composer__service-note" role="status">
            Posting is temporarily unavailable. Your draft will stay on this page.
          </div>
        ) : null}

        <div className="product-post-composer__footer">
          <div>
            <strong>Ready to ask the community?</strong>
            <span>You can edit the post for seven days after publishing.</span>
          </div>
          <Button type="submit" size="lg" loading={busy} disabled={unavailable || !imageFile}>
            Publish request
          </Button>
        </div>

        {status ? (
          <div className="product-store-preview-status" role="status">
            {status}
          </div>
        ) : null}
      </form>
    </Card>
  );
}

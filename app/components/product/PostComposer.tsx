import { useState } from "react";
import { useNavigate } from "react-router";
import type { PostCategorySlug } from "../../../shared/posts/categories";
import { readCsrfToken } from "../../data/csrf";
import { useI18n } from "../../i18n/I18nProvider";
import { Button, Card, Input, Switch, Textarea } from "../ui";
import { CategoryPicker } from "./CategoryPicker";
import { CosmeticIdentity, type CosmeticIdentityProps } from "./CosmeticIdentity";
import { ImageUploadField } from "./ImageUploadField";
import "./post-composer.css";

export interface PostComposerIdentity {
  displayName: string;
  avatarUrl?: string;
  cosmetics: Pick<CosmeticIdentityProps, "avatarFrame" | "nameFont" | "nameEffect">;
}

type PostVisibility = "PUBLIC" | "FRIENDS_ONLY" | "UNLISTED" | "PRIVATE";

interface PostComposerProps {
  identity: PostComposerIdentity | null;
  unavailable?: boolean;
}

export function PostComposer({ identity, unavailable = false }: PostComposerProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [authorMode, setAuthorMode] = useState<"IDENTIFIED" | "ANONYMOUS">("IDENTIFIED");
  const [visibility, setVisibility] = useState<PostVisibility>("PUBLIC");
  const [category, setCategory] = useState<PostCategorySlug | null>(null);
  const [isNsfw, setIsNsfw] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!imageFile) {
      setStatus(t("composer.imageRequired"));
      return;
    }
    if (!category) {
      setStatus(t("composer.categoryRequired"));
      return;
    }

    setBusy(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    form.set("file", imageFile, imageFile.name);
    form.set("authorMode", authorMode);
    form.set("visibility", visibility);
    form.set("category", category);
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
        setStatus(body?.error?.message ?? t("composer.publishError"));
        return;
      }

      const postPath = `/posts/${encodeURIComponent(body.post.id)}`;
      const destination = body.post.slug
        ? `${postPath}/${encodeURIComponent(body.post.slug)}`
        : postPath;
      navigate(destination, { replace: true });
    } catch {
      setStatus(t("composer.connectionError"));
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
              <h2 id="post-image-heading">{t("composer.image.title")}</h2>
            </div>
            <p>{t("composer.image.description")}</p>
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
              <h2 id="post-context-heading">{t("composer.context.title")}</h2>
            </div>
            <p>{t("composer.context.description")}</p>
          </div>
          <Input
            label={t("composer.title.label")}
            name="title"
            placeholder={t("composer.title.placeholder")}
            maxLength={160}
            required
            disabled={unavailable || busy}
          />
          <Textarea
            label={t("composer.description.label")}
            name="description"
            placeholder={t("composer.description.placeholder")}
            maxLength={10_000}
            disabled={unavailable || busy}
          />
        </section>

        <section className="product-post-composer__section" aria-labelledby="post-category-heading">
          <div className="product-post-composer__section-heading">
            <div>
              <span className="product-post-composer__step">3</span>
              <h2 id="post-category-heading">{t("composer.category.title")}</h2>
            </div>
            <p>{t("composer.category.description")}</p>
          </div>
          <CategoryPicker value={category} onChange={setCategory} disabled={unavailable || busy} />
        </section>

        <section className="product-post-composer__section" aria-labelledby="post-audience-heading">
          <div className="product-post-composer__section-heading">
            <div>
              <span className="product-post-composer__step">4</span>
              <h2 id="post-audience-heading">{t("composer.audience.title")}</h2>
            </div>
            <p>{t("composer.audience.description")}</p>
          </div>

          <label className="product-field-native">
            <span>{t("composer.visibility")}</span>
            <select
              name="visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.currentTarget.value as PostVisibility)}
              aria-label={t("composer.visibility")}
              disabled={unavailable || busy}
            >
              <option value="PUBLIC">{t("composer.visibility.public")}</option>
              <option value="FRIENDS_ONLY" disabled={authorMode === "ANONYMOUS"}>
                {t("composer.visibility.friends")}
              </option>
              <option value="UNLISTED">{t("composer.visibility.unlisted")}</option>
              <option value="PRIVATE">{t("composer.visibility.private")}</option>
            </select>
          </label>

          <Switch
            label={t("composer.anonymous.label")}
            description={t("composer.anonymous.description")}
            checked={authorMode === "ANONYMOUS"}
            disabled={unavailable || busy}
            onCheckedChange={setAnonymous}
          />

          <div
            className="product-presentation-notice"
            role="note"
            aria-label={t("composer.authorPreview")}
          >
            <strong>{t("composer.authorPreview")}</strong>
            {authorMode === "ANONYMOUS" ? (
              <span>{t("composer.anonymousAuthor")}</span>
            ) : identity ? (
              <CosmeticIdentity
                displayName={identity.displayName}
                avatarUrl={identity.avatarUrl}
                avatarFrame={identity.cosmetics.avatarFrame}
                nameFont={identity.cosmetics.nameFont}
                nameEffect={identity.cosmetics.nameEffect}
                mode="preview"
                nameAs="strong"
              />
            ) : (
              <span>{t("composer.member")}</span>
            )}
          </div>

          <Switch
            label={t("composer.nsfw.label")}
            description={t("composer.nsfw.description")}
            checked={isNsfw}
            disabled={unavailable || busy}
            onCheckedChange={setIsNsfw}
          />
        </section>

        {unavailable ? (
          <div className="product-post-composer__service-note" role="status">
            {t("composer.unavailable")}
          </div>
        ) : null}

        <div className="product-post-composer__footer">
          <div>
            <strong>{t("composer.ready.title")}</strong>
            <span>{t("composer.ready.description")}</span>
          </div>
          <Button
            type="submit"
            size="lg"
            loading={busy}
            disabled={unavailable || !imageFile || !category}
          >
            {t("composer.publish")}
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
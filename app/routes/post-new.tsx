import { useState } from "react";
import { useLoaderData } from "react-router";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";
import { ProductShell, PageHeader } from "../components/product/ProductShell";
import { Button, Card, Input, Switch, Textarea } from "../components/ui";

export async function loader({ request, context }: ServerLoaderArgs) {
  return withOptionalServerSession(
    request,
    context,
    (unavailable) => ({ authenticated: false, unavailable }),
    async (_runtime, userId) => ({ authenticated: Boolean(userId), unavailable: false }),
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

function readCsrfToken(): string {
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("__Host-sourceboard_csrf="));
  return entry ? decodeURIComponent(entry.slice("__Host-sourceboard_csrf=".length)) : "";
}

export default function NewPostRoute() {
  const { authenticated, unavailable } = useLoaderData<LoaderData>();
  const [authorMode, setAuthorMode] = useState<"IDENTIFIED" | "ANONYMOUS">("IDENTIFIED");
  const [isNsfw, setIsNsfw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authenticated) {
      setStatus("Sign in before publishing a source request.");
      return;
    }
    setBusy(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    form.set("authorMode", authorMode);
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
      window.location.assign(
        `/posts/${encodeURIComponent(body.post.id)}/${encodeURIComponent(body.post.slug ?? "")}`,
      );
    } catch {
      setStatus("The source request could not be published.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProductShell>
      <PageHeader
        eyebrow="New request"
        title="Create a source request"
        description="Give the community one clear image and enough context to trace where it originally came from."
      />

      <Card className="product-form-card">
        <form className="product-form-grid" onSubmit={(event) => void submit(event)}>
          <Input
            label="Main image"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            hint="JPEG, PNG, WebP or AVIF; maximum 10 MB."
            required
            disabled={!authenticated}
          />
          <Input
            label="Title"
            name="title"
            placeholder="Where did this image originally come from?"
            maxLength={160}
            required
            disabled={!authenticated}
          />
          <Textarea
            label="Description"
            name="description"
            placeholder="Where you found it, what you already tried, and what kind of source you need…"
            maxLength={10_000}
            disabled={!authenticated}
          />
          <label className="product-field-native">
            <span>Visibility</span>
            <select
              name="visibility"
              defaultValue="PUBLIC"
              aria-label="Visibility"
              disabled={!authenticated}
            >
              <option value="PUBLIC">Public</option>
              <option value="FRIENDS_ONLY">Friends only</option>
              <option value="UNLISTED">Unlisted</option>
              <option value="PRIVATE">Private</option>
            </select>
          </label>
          <Switch
            label="Post anonymously"
            description="Public responses use Anonymous Author; the real ownership record stays server-side."
            checked={authorMode === "ANONYMOUS"}
            disabled={!authenticated}
            onCheckedChange={(checked) => setAuthorMode(checked ? "ANONYMOUS" : "IDENTIFIED")}
          />
          <Switch
            label="Mark as NSFW"
            description="The server applies your audience's sensitive-content preferences before serving media."
            checked={isNsfw}
            disabled={!authenticated}
            onCheckedChange={setIsNsfw}
          />
          <div className="product-presentation-notice" role="note">
            <strong>{unavailable ? "Post service unavailable" : "Publishing is connected"}</strong>
            <span>
              {unavailable
                ? "This environment has no D1 post service."
                : authenticated
                  ? "The image and metadata will be validated by the Worker before the post is created."
                  : "Sign in to upload an image and publish."}
            </span>
          </div>
          <Button type="submit" size="lg" loading={busy} disabled={!authenticated || unavailable}>
            Publish request
          </Button>
          {status ? (
            <div className="product-store-preview-status" role="status">
              {status}
            </div>
          ) : null}
        </form>
      </Card>
    </ProductShell>
  );
}

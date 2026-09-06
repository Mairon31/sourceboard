import { useState } from "react";
import { ProductShell, PageHeader, PresentationNotice } from "../components/product/ProductShell";
import { Button, Card, Input, Switch, Textarea } from "../components/ui";

export default function NewPostRoute() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <ProductShell>
      <PageHeader
        eyebrow="New request"
        title="Create a source request"
        description="Give the community one clear image and enough context to trace where it originally came from."
      />

      <Card className="product-form-card">
        <form
          className="product-form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
          }}
        >
          <div className="product-upload-zone">
            <div>
              <strong>Image preview area</strong>
              <p>R2 upload is intentionally not connected in Phase 0B.</p>
            </div>
          </div>
          <Input
            label="Title"
            name="title"
            placeholder="Where did this image originally come from?"
            maxLength={160}
            required
          />
          <Textarea
            label="Description"
            name="description"
            placeholder="Where you found it, what you already tried, and what kind of source you need…"
          />
          <label className="product-field-native">
            <span>Visibility</span>
            <select name="visibility" defaultValue="PUBLIC" aria-label="Visibility">
              <option value="PUBLIC">Public</option>
              <option value="FRIENDS_ONLY">Friends only</option>
              <option value="UNLISTED">Unlisted</option>
              <option value="PRIVATE">Private</option>
            </select>
          </label>
          <Switch
            label="Post anonymously"
            description="Your public profile will not be linked to the post. Authorized administrators can access the real author for abuse prevention."
          />
          <Switch
            label="Mark as NSFW"
            description="Use this when the image needs the site's sensitive-content treatment."
          />
          <PresentationNotice>
            Publishing, image upload and persistence connect in later backend phases.
          </PresentationNotice>
          <Button type="submit" size="lg">
            Publish request
          </Button>
        </form>
        {submitted ? (
          <div className="product-store-preview-status">Presentation only — request validated locally but was not published.</div>
        ) : null}
      </Card>
    </ProductShell>
  );
}

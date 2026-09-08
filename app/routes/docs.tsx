import { Link, type MetaFunction } from "react-router";
import { PageHeader, ProductShell } from "../components/product/ProductShell";
import { Card } from "../components/ui";

export const meta: MetaFunction = () => [
  { title: "Guide · SourceBoard" },
  {
    name: "description",
    content: "Learn how SourceBoard requests, evidence, discussions and privacy work.",
  },
  { tagName: "link", rel: "canonical", href: "https://srcboard.me/docs" },
];

export default function DocsRoute() {
  return (
    <ProductShell wide>
      <PageHeader
        eyebrow="SourceBoard guide"
        title="How the source trail works"
        description="A short guide to publishing a request, checking evidence and keeping discussions useful."
      />
      <div className="product-docs-grid">
        <Card>
          <span className="product-eyebrow">01 · Request</span>
          <h2>Start with the image</h2>
          <p>
            Upload one image, describe what you already know and choose who can see the request.
          </p>
        </Card>
        <Card>
          <span className="product-eyebrow">02 · Evidence</span>
          <h2>Prefer a source link</h2>
          <p>
            Comments can include context and a canonical URL. The author can accept one source and
            the community can verify it.
          </p>
        </Card>
        <Card>
          <span className="product-eyebrow">03 · Discussion</span>
          <h2>Keep the trail readable</h2>
          <p>
            Accepted requests may be closed by their author. Existing comments remain available for
            review and audit.
          </p>
        </Card>
        <Card>
          <span className="product-eyebrow">04 · Privacy</span>
          <h2>Visibility is enforced on the server</h2>
          <p>
            Private, friends-only, blocked and sensitive content decisions are checked before data
            or media is returned.
          </p>
        </Card>
      </div>
      <Card className="product-docs-note">
        <h2>Need to change your account?</h2>
        <p>Manage privacy, sensitive-content and friend-request preferences from Settings.</p>
        <Link className="product-text-action" to="/settings">
          Open Settings
        </Link>
      </Card>
    </ProductShell>
  );
}

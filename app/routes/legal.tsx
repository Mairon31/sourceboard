import { PageHeader, ProductShell } from "../components/product/ProductShell";
import { Card } from "../components/ui";
import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Policies · SourceBoard" },
  {
    name: "description",
    content: "SourceBoard privacy, attribution and community policies.",
  },
  { tagName: "link", rel: "canonical", href: "https://srcboard.me/legal" },
];

export default function LegalRoute() {
  return (
    <ProductShell wide>
      <PageHeader
        eyebrow="Policies"
        title="Privacy and community rules"
        description="The product rules that shape visibility, moderation and source attribution."
      />
      <div className="product-policy-stack">
        <Card>
          <h2>Data handling</h2>
          <p>
            SourceBoard stores account, post and moderation data needed to operate the service.
            Private content is served only after the server checks the viewer's permissions.
          </p>
          <p>
            Uploaded media is kept in private object storage and is delivered through authenticated,
            policy-aware routes where required.
          </p>
        </Card>
        <Card>
          <h2>Community rules</h2>
          <p>
            Share accurate source information, respect creators and do not use comments for
            harassment, spam, doxxing or unsafe links. Use the report action when a post or comment
            breaks these rules.
          </p>
        </Card>
        <Card>
          <h2>Attribution</h2>
          <p>
            An accepted source records the author's current decision. Verification adds a separate
            review state; neither state changes the original creator's ownership or copyright.
          </p>
        </Card>
      </div>
    </ProductShell>
  );
}

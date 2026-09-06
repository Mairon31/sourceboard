import type { AcceptedSourceView, VerifiedSourceView } from "../../../shared/ui/contracts";
import { Badge, Card } from "../ui";

export function SourceResolution({
  accepted,
  verified,
}: {
  accepted?: AcceptedSourceView;
  verified?: VerifiedSourceView;
}) {
  if (!accepted && !verified) return null;

  return (
    <section className="product-source-resolution" aria-label="Source resolution">
      {accepted ? (
        <Card className="product-source-card product-source-card--accepted">
          <div className="product-source-card__icon" aria-hidden="true">
            ✓
          </div>
          <div>
            <Badge tone="accent">Accepted Source</Badge>
            <h2>Request resolved by the post author</h2>
            <p>The author marked this comment as the answer that solved the source request.</p>
            {accepted.canonicalUrl ? (
              <a href={accepted.canonicalUrl} target="_blank" rel="noreferrer">
                Open source reference
              </a>
            ) : null}
          </div>
        </Card>
      ) : null}

      {verified ? (
        <Card className="product-source-card product-source-card--verified">
          <div className="product-source-card__icon" aria-hidden="true">
            ✓
          </div>
          <div>
            <Badge tone="success">Verified Source</Badge>
            <h2>Source authenticity verified</h2>
            <p>{verified.evidenceSummary}</p>
            <div className="product-source-card__meta">
              <span>{verified.verifierLabel}</span>
              <a href={verified.canonicalUrl} target="_blank" rel="noreferrer">
                Canonical source
              </a>
            </div>
          </div>
        </Card>
      ) : null}
    </section>
  );
}

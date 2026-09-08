import type {
  AcceptedSourceView,
  CommentView,
  VerifiedSourceView,
} from "../../../shared/ui/contracts";
import { Badge, Card, Avatar } from "../ui";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { RichText } from "./RichText";

function AcceptedComment({ comment }: { comment: CommentView }) {
  const nodes = [
    {
      type: "paragraph" as const,
      children: comment.richtext ?? [{ type: "text" as const, text: comment.body }],
    },
  ];
  const imageUrl = comment.attachment?.url ?? comment.attachment?.preview;
  return (
    <article className="product-source-answer">
      <header className="product-source-answer__author">
        {comment.author.mode === "ANONYMOUS" ? (
          <>
            <Avatar name="Anonymous Author" size="sm" />
            <strong>Anonymous Author</strong>
          </>
        ) : (
          <CosmeticIdentity
            displayName={comment.author.displayName}
            avatarUrl={comment.author.avatarUrl}
            avatarFrame={comment.author.avatarFrame}
            profileEffect={comment.author.profileEffect}
            nameFont={comment.author.nameFont}
            nameEffect={comment.author.nameEffect}
            visuals={comment.author.visuals}
            mode="compact"
            avatarSize="sm"
            nameAs="strong"
          />
        )}
        <span>
          {new Date(comment.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })}
        </span>
      </header>
      <div className="product-source-answer__content">
        <RichText nodes={nodes} />
        {imageUrl ? (
          <img
            className={`product-source-answer__media product-source-answer__media--${comment.attachment?.type.toLowerCase()}`}
            src={imageUrl}
            alt={comment.attachment?.label ?? "Accepted source attachment"}
            loading="lazy"
          />
        ) : null}
      </div>
    </article>
  );
}

export function SourceResolution({
  accepted,
  acceptedComment,
  verified,
}: {
  accepted?: AcceptedSourceView;
  acceptedComment?: CommentView;
  verified?: VerifiedSourceView;
}) {
  if (!accepted && !verified) return null;

  return (
    <section className="product-source-resolution" aria-label="Source resolution">
      {accepted ? (
        <Card className="product-source-card product-source-card--accepted">
          <div className="product-source-card__heading">
            <div className="product-source-card__icon" aria-hidden="true">
              ✓
            </div>
            <div>
              <Badge tone="accent">Accepted Source</Badge>
              <h2>Accepted answer</h2>
              <p>
                The post author marked this contribution as the source that resolved the request.
              </p>
            </div>
          </div>
          {acceptedComment ? <AcceptedComment comment={acceptedComment} /> : null}
          {accepted.canonicalUrl ? (
            <a href={accepted.canonicalUrl} target="_blank" rel="noreferrer">
              Open source reference
            </a>
          ) : null}
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

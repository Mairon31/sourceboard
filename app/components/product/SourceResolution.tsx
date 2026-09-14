import type {
  AcceptedSourceView,
  CommentView,
  VerifiedSourceView,
} from "../../../shared/ui/contracts";
import { Link } from "react-router";
import { useI18n } from "../../i18n/I18nProvider";
import { Badge, Card } from "../ui";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { RichText } from "./RichText";

function AcceptedComment({ comment }: { comment: CommentView }) {
  const { t, date } = useI18n();
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
          <CosmeticIdentity anonymous mode="compact" avatarSize="sm" nameAs="strong" />
        ) : comment.author.profileUrl ? (
          <Link className="product-source-answer__identity-link" to={comment.author.profileUrl}>
            <CosmeticIdentity
              displayName={comment.author.displayName}
              avatarUrl={comment.author.avatarUrl}
              avatarFrame={comment.author.avatarFrame}
              nameFont={comment.author.nameFont}
              nameEffect={comment.author.nameEffect}
              visuals={comment.author.visuals}
              mode="compact"
              avatarSize="sm"
              nameAs="strong"
            />
          </Link>
        ) : (
          <CosmeticIdentity
            displayName={comment.author.displayName}
            avatarUrl={comment.author.avatarUrl}
            avatarFrame={comment.author.avatarFrame}
            nameFont={comment.author.nameFont}
            nameEffect={comment.author.nameEffect}
            visuals={comment.author.visuals}
            mode="compact"
            avatarSize="sm"
            nameAs="strong"
          />
        )}
        <span>
          {date(new Date(comment.createdAt), {
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
            alt={comment.attachment?.label ?? t("source.accepted.attachmentAlt")}
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
  const { t } = useI18n();
  if (!accepted && !verified) return null;

  const resolution = verified ?? accepted;
  const isVerified = Boolean(verified);
  const canonicalUrl = resolution?.canonicalUrl;
  const badge = isVerified ? t("source.verified.badge") : t("source.accepted.badge");
  const title = isVerified ? t("source.verified.title") : t("source.accepted.title");
  const referenceLabel = isVerified
    ? t("source.verified.canonical")
    : t("source.accepted.openReference");

  return (
    <section className="product-source-resolution" aria-label={t("source.resolutionAria")}>
      <Card
        className={`product-source-card product-source-card--${isVerified ? "verified" : "accepted"}`}
      >
        <div className="product-source-card__heading">
          <div className="product-source-card__icon" aria-hidden="true">
            {isVerified ? "✓" : "↗"}
          </div>
          <div>
            <Badge tone={isVerified ? "success" : "accent"}>{badge}</Badge>
            <h2>{title}</h2>
            <p>{isVerified ? verified?.evidenceSummary : t("source.accepted.description")}</p>
          </div>
        </div>
        {acceptedComment ? <AcceptedComment comment={acceptedComment} /> : null}
        {canonicalUrl ? (
          <a href={canonicalUrl} target="_blank" rel="noreferrer">
            {referenceLabel}
          </a>
        ) : null}
      </Card>
    </section>
  );
}

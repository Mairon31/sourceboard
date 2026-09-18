import type {
  AcceptedSourceView,
  CommentView,
  VerifiedSourceView,
} from "../../../shared/ui/contracts";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { useI18n } from "../../i18n/I18nProvider";
import { Badge, Card, CheckIcon, ExternalLinkIcon, ShieldCheckIcon } from "../ui";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { RichText } from "./RichText";
import { MediaLightbox } from "./MediaLightbox";

function AcceptedComment({ comment }: { comment: CommentView }) {
  const { t, date } = useI18n();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imageTriggerRef = useRef<HTMLElement | null>(null);
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
          comment.attachment?.type === "IMAGE" ? (
            <button
              type="button"
              className="product-source-answer__media-button"
              aria-label={t("comments.composer.openImage")}
              onClick={(event) => {
                imageTriggerRef.current = event.currentTarget;
                setLightboxOpen(true);
              }}
            >
              <img
                className="product-source-answer__media product-source-answer__media--image"
                src={imageUrl}
                alt={comment.attachment.label ?? t("source.accepted.attachmentAlt")}
                loading="lazy"
              />
            </button>
          ) : (
            <img
              className={`product-source-answer__media product-source-answer__media--${comment.attachment?.type.toLowerCase()}`}
              src={imageUrl}
              alt={comment.attachment?.label ?? t("source.accepted.attachmentAlt")}
              loading="lazy"
            />
          )
        ) : null}
        {comment.linkPreview ? <LinkPreviewCard preview={comment.linkPreview} compact /> : null}
      </div>
      {imageUrl && comment.attachment?.type === "IMAGE" ? (
        <MediaLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          src={imageUrl}
          alt={comment.attachment.label ?? t("source.accepted.attachmentAlt")}
          returnFocusRef={imageTriggerRef}
        />
      ) : null}
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
            {isVerified ? (
              <ShieldCheckIcon width="20" height="20" />
            ) : (
              <CheckIcon width="20" height="20" />
            )}
          </div>
          <div className="product-source-card__summary">
            <Badge tone={isVerified ? "success" : "accent"}>{badge}</Badge>
            <h2>{title}</h2>
            {isVerified ? (
              verified?.evidenceSummary ? (
                <p>{verified.evidenceSummary}</p>
              ) : null
            ) : (
              <p>{t("source.accepted.description")}</p>
            )}
          </div>
        </div>
        {acceptedComment ? <AcceptedComment comment={acceptedComment} /> : null}
        {canonicalUrl ? (
          <a
            className="product-source-card__reference focus-ring"
            href={canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLinkIcon width="16" height="16" />
            <span>{referenceLabel}</span>
          </a>
        ) : null}
      </Card>
    </section>
  );
}

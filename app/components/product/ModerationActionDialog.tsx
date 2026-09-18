import { useEffect, useMemo, useState } from "react";
import type { CommentView, PostSummary } from "../../../shared/ui/contracts";
import { POST_CATEGORIES } from "../../../shared/posts/categories";
import type { ModerationAction } from "../../../worker/moderation/service";
import { readCsrfToken } from "../../data/csrf";
import { useI18n } from "../../i18n/I18nProvider";
import { Button, Modal, OverlayActionRow, Textarea } from "../ui";

type PostTarget = {
  targetType: "POST";
  post: PostSummary;
};

type CommentTarget = {
  targetType: "COMMENT";
  comment: Pick<CommentView, "id" | "state">;
};

export type ModerationActionTarget = PostTarget | CommentTarget;

export function ModerationActionDialog({
  open,
  target,
  onOpenChange,
  onApplied,
}: {
  open: boolean;
  target: ModerationActionTarget;
  onOpenChange: (open: boolean) => void;
  onApplied?: (action: ModerationAction) => void;
}) {
  const { t } = useI18n();
  const [selectedAction, setSelectedAction] = useState<ModerationAction | null>(null);
  const [reason, setReason] = useState("");
  const [categorySlug, setCategorySlug] = useState(
    target.targetType === "POST" ? target.post.categorySlug : "other",
  );
  const [durationMs, setDurationMs] = useState("86400000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setSelectedAction(null);
    setReason("");
    setError(undefined);
    setCategorySlug(target.targetType === "POST" ? target.post.categorySlug : "other");
    setDurationMs("86400000");
  }, [open, target]);

  const actions = useMemo(() => {
    if (target.targetType === "COMMENT") {
      return target.comment.state === "HIDDEN"
        ? (["RESTORE"] as ModerationAction[])
        : (["HIDE"] as ModerationAction[]);
    }
    const permissions = target.post.permissions ?? {};
    const canModerateCore = Boolean(permissions.canModerate);
    const result: ModerationAction[] = [];
    if ((canModerateCore || permissions.canModerateDelete) && !target.post.deletedAt)
      result.push("DELETE");
    if ((canModerateCore || permissions.canModerateArchive) && !target.post.deletedAt)
      result.push(target.post.status === "ARCHIVED" ? "UNARCHIVE" : "ARCHIVE");
    if ((canModerateCore || permissions.canModerateCategory) && !target.post.deletedAt)
      result.push("CHANGE_CATEGORY");
    if ((canModerateCore || permissions.canModerateComments) && !target.post.deletedAt)
      result.push(target.post.commentsClosed ? "REOPEN_COMMENTS" : "CLOSE_COMMENTS");
    if (canModerateCore || permissions.canModerateLikes)
      result.push(target.post.likeCountHidden ? "SHOW_LIKES" : "HIDE_LIKES");
    if (target.post.isNsfw && permissions.canModerateUnmarkNsfw) result.push("UNMARK_NSFW");
    if (!target.post.isNsfw && permissions.canModerateMarkNsfw) result.push("MARK_NSFW");
    if (permissions.canModerateLock)
      result.push(target.post.status === "LOCKED" ? "UNLOCK" : "LOCK");
    if (permissions.canModerateHide) result.push("HIDE");
    if (target.post.verifiedSource && permissions.canModerateSource)
      result.push("REVOKE_SOURCE_VERIFICATION");
    if (permissions.canModerateTimeout) result.push("TIMEOUT_AUTHOR");
    return result;
  }, [target]);

  function label(action: ModerationAction): string {
    if (target.targetType === "COMMENT") {
      if (action === "HIDE") return t("comments.actions.hide");
      if (action === "RESTORE") return t("comments.actions.restore");
    }
    const labels: Partial<Record<ModerationAction, string>> = {
      DELETE: t("post.moderation.action.delete"),
      ARCHIVE: t("post.moderation.action.archive"),
      UNARCHIVE: t("post.moderation.action.unarchive"),
      CHANGE_CATEGORY: t("post.moderation.action.category"),
      CLOSE_COMMENTS: t("post.moderation.action.closeComments"),
      REOPEN_COMMENTS: t("post.moderation.action.reopenComments"),
      HIDE_LIKES: t("post.moderation.action.hideLikes"),
      SHOW_LIKES: t("post.moderation.action.showLikes"),
      MARK_NSFW: t("post.moderation.action.markNsfw"),
      UNMARK_NSFW: t("post.moderation.action.unmarkNsfw"),
      LOCK: t("post.moderation.action.lock"),
      UNLOCK: t("post.moderation.action.unlock"),
      HIDE: t("post.moderation.action.hide"),
      RESTORE: t("post.moderation.action.restore"),
      REVOKE_SOURCE_VERIFICATION: t("post.moderation.action.revokeSource"),
      TIMEOUT_AUTHOR: t("post.moderation.action.timeoutAuthor"),
    };
    return labels[action] ?? action;
  }

  async function applyAction() {
    if (!selectedAction || busy || reason.trim().length < 3) return;
    setBusy(true);
    setError(undefined);
    const body: Record<string, unknown> = {
      targetType: target.targetType,
      targetId: target.targetType === "POST" ? target.post.id : target.comment.id,
      action: selectedAction,
      reason: reason.trim(),
    };
    if (selectedAction === "CHANGE_CATEGORY") body.categorySlug = categorySlug;
    if (selectedAction === "TIMEOUT_AUTHOR") body.durationMs = Number(durationMs);
    try {
      const response = await fetch("/api/admin/moderation/action", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(
          payload?.error?.message ??
            t(
              target.targetType === "COMMENT"
                ? "comments.moderation.error"
                : "post.moderation.error",
            ),
        );
        return;
      }
      onApplied?.(selectedAction);
      onOpenChange(false);
    } catch {
      setError(
        t(target.targetType === "COMMENT" ? "comments.moderation.error" : "post.moderation.error"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={
        target.targetType === "COMMENT"
          ? t("comments.moderation.title")
          : t("post.moderation.title")
      }
      description={
        target.targetType === "COMMENT"
          ? t("comments.moderation.description")
          : t("post.moderation.description")
      }
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy) onOpenChange(nextOpen);
      }}
      className="product-moderation-dialog"
    >
      {!selectedAction ? (
        <div className="product-moderation-dialog__actions">
          {actions.map((action) => (
            <Button
              key={action}
              type="button"
              variant={action === "DELETE" ? "danger" : "secondary"}
              onClick={() => {
                setSelectedAction(action);
                setReason("");
                setError(undefined);
              }}
            >
              {label(action)}
            </Button>
          ))}
          {!actions.length ? <p>{t("post.moderation.noActions")}</p> : null}
        </div>
      ) : (
        <div className="product-moderation-dialog__form">
          <strong>{label(selectedAction)}</strong>
          {selectedAction === "CHANGE_CATEGORY" ? (
            <label className="product-field-native">
              <span>{t("post.moderation.category")}</span>
              <select
                value={categorySlug}
                disabled={busy}
                onChange={(event) => setCategorySlug(event.target.value)}
              >
                {POST_CATEGORIES.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {selectedAction === "TIMEOUT_AUTHOR" ? (
            <label className="product-field-native">
              <span>{t("post.moderation.duration")}</span>
              <select
                value={durationMs}
                disabled={busy}
                onChange={(event) => setDurationMs(event.target.value)}
              >
                <option value="3600000">{t("post.moderation.oneHour")}</option>
                <option value="86400000">{t("post.moderation.oneDay")}</option>
                <option value="604800000">{t("post.moderation.sevenDays")}</option>
                <option value="2592000000">{t("post.moderation.thirtyDays")}</option>
              </select>
            </label>
          ) : null}
          <Textarea
            label={t("post.moderation.reason")}
            value={reason}
            maxLength={2000}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
          />
          <OverlayActionRow>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setSelectedAction(null)}
            >
              {t("post.moderation.back")}
            </Button>
            <Button
              type="button"
              variant={selectedAction === "DELETE" ? "danger" : "primary"}
              loading={busy}
              disabled={reason.trim().length < 3}
              onClick={() => void applyAction()}
            >
              {t("post.moderation.apply")}
            </Button>
          </OverlayActionRow>
          {error ? (
            <p className="sb-field__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

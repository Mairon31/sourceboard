import { useCallback, useEffect, useMemo, useState } from "react";
import type { CosmeticVisualDefinition } from "../../../../shared/store/custom-cosmetics";
import { Button, Card } from "../../ui";
import { readCsrfToken } from "../../../data/csrf";
import {
  isAvatarFramePreset,
  isNameEffectPreset,
  isNameFontFamily,
  isProfileEffectPreset,
  isProfileThemePreset,
} from "../../../../shared/store/cosmetics";
import { CosmeticPreview, type CosmeticPreviewInput } from "../../product/CosmeticPreview";
import { useI18n } from "../../../i18n/I18nProvider";
import type { MessageKey } from "../../../i18n";

type CommunityState = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
type ModerationState = "CLEAR" | "HIDDEN" | "REMOVED";
type CommunityAction = "APPROVE" | "REJECT" | "HIDE" | "RESTORE" | "ARCHIVE" | "REMOVE";
type CommunitySubmission = {
  id: string;
  type: string;
  name: string;
  description: string;
  pricePoints: number;
  configJson: string;
  lifecycleState: string;
  isEnabled: boolean | number;
  reviewState: string;
  communityState: CommunityState;
  moderationState: ModerationState;
  reviewNote: string | null;
  submittedByUserId: string;
  submittedByUsername: string;
  submittedByDisplayName: string;
  createdAt: number;
  reviewedAt: number | null;
};

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const message = (payload as { error?: { message?: unknown } }).error?.message;
  return typeof message === "string" ? message : fallback;
}
function configFromJson(configJson: string): {
  preset?: unknown;
  family?: unknown;
  visual?: CosmeticVisualDefinition;
  communityCss?: string;
  communityCosmeticId?: string;
} {
  try {
    return JSON.parse(configJson) as {
      preset?: unknown;
      family?: unknown;
      visual?: CosmeticVisualDefinition;
      communityCss?: string;
      communityCosmeticId?: string;
    };
  } catch {
    return {};
  }
}

function previewInput(type: string, config: Record<string, unknown>): CosmeticPreviewInput | null {
  if (type === "AVATAR_FRAME" && isAvatarFramePreset(config.preset)) {
    return { type, preset: config.preset };
  }
  if (type === "PROFILE_BANNER" && isProfileThemePreset(config.preset)) {
    return { type, preset: config.preset };
  }
  if (type === "PROFILE_EFFECT" && isProfileEffectPreset(config.preset)) {
    return { type, preset: config.preset };
  }
  if (type === "NAME_EFFECT" && isNameEffectPreset(config.preset)) {
    return { type, preset: config.preset };
  }
  if (type === "NAME_FONT" && isNameFontFamily(config.family)) {
    return { type, preset: config.family };
  }
  return null;
}
const STATE_LABELS: Record<CommunityState, MessageKey> = {
  DRAFT: "community.state.draft",
  PENDING_REVIEW: "community.state.pendingReview",
  PUBLISHED: "community.state.published",
  REJECTED: "community.state.rejected",
  ARCHIVED: "community.state.archived",
};
const ACTION_LABELS: Record<CommunityAction, MessageKey> = {
  APPROVE: "admin.community.action.approve",
  REJECT: "admin.community.action.reject",
  HIDE: "admin.community.action.hide",
  RESTORE: "admin.community.action.restore",
  ARCHIVE: "admin.community.action.archive",
  REMOVE: "admin.community.action.remove",
};
const MODERATION_LABELS: Record<ModerationState, MessageKey> = {
  CLEAR: "admin.community.moderation.clear",
  HIDDEN: "admin.community.moderation.hidden",
  REMOVED: "admin.community.moderation.removed",
};

function stateLabel(state: CommunityState): MessageKey {
  return STATE_LABELS[state];
}
function actionLabel(action: CommunityAction): MessageKey {
  return ACTION_LABELS[action];
}
function moderationLabel(state: ModerationState): MessageKey {
  return MODERATION_LABELS[state];
}
function typeLabel(type: string): MessageKey {
  if (type === "AVATAR_FRAME") return "community.type.avatarFrame";
  if (type === "PROFILE_BANNER") return "community.type.profileBanner";
  if (type === "PROFILE_EFFECT") return "community.type.profileEffect";
  if (type === "NAME_EFFECT") return "community.type.nameEffect";
  if (type === "NAME_FONT") return "community.type.nameFont";
  return "admin.community.unknownType";
}
function actionsFor(submission: CommunitySubmission): CommunityAction[] {
  if (submission.communityState === "PENDING_REVIEW") return ["APPROVE", "REJECT"];
  if (submission.communityState === "PUBLISHED")
    return submission.moderationState === "HIDDEN"
      ? ["RESTORE", "ARCHIVE", "REMOVE"]
      : ["HIDE", "ARCHIVE", "REMOVE"];
  if (submission.communityState === "REJECTED") return ["ARCHIVE", "REMOVE"];
  return [];
}

export function AdminCommunityCosmeticReviews({
  onStatus,
  onCatalogRefresh,
}: {
  onStatus: (message: string) => void;
  onCatalogRefresh: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<CommunityState>("PENDING_REVIEW");
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decision, setDecision] = useState<{
    submission: CommunitySubmission;
    value: CommunityAction;
  } | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/cosmetics/submissions?state=${encodeURIComponent(state)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as {
        submissions?: CommunitySubmission[];
      } | null;
      if (!response.ok) {
        onStatus(errorMessage(payload, t("admin.community.loadFailed")));
        return;
      }
      setSubmissions(Array.isArray(payload?.submissions) ? payload.submissions : []);
    } catch {
      onStatus(t("admin.community.loadFailedConnection"));
    } finally {
      setLoading(false);
    }
  }, [onStatus, state, t]);
  useEffect(() => {
    void load();
  }, [load]);
  const counts = useMemo(() => submissions.length, [submissions.length]);

  async function submitDecision() {
    if (!decision || reason.trim().length < 3) return;
    setBusyId(decision.submission.id);
    try {
      const response = await fetch(
        `/api/admin/cosmetics/submissions/${encodeURIComponent(decision.submission.id)}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify({ decision: decision.value, reason: reason.trim() }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onStatus(errorMessage(payload, t("admin.community.moderateFailed")));
        return;
      }
      onStatus(
        t("admin.community.actionCompleted", {
          name: decision.submission.name,
          action: t(actionLabel(decision.value)),
        }),
      );
      setDecision(null);
      setReason("");
      await Promise.all([load(), onCatalogRefresh()]);
    } catch {
      onStatus(t("admin.community.moderateFailedConnection"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="admin-store-catalog admin-community-cosmetics">
      <div className="admin-store-section-heading">
        <div>
          <span className="product-eyebrow">{t("admin.community.eyebrow")}</span>
          <h2>{t("admin.community.title")}</h2>
          <p>{t("admin.community.description")}</p>
        </div>
        <span className="product-search-count">
          {t("admin.community.count", { count: counts })}
        </span>
      </div>
      <nav className="admin-store-type-filters" aria-label={t("admin.community.stateFilter")}>
        {(["PENDING_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={state === value ? "is-active" : undefined}
            aria-pressed={state === value}
            onClick={() => setState(value)}
          >
            {t(stateLabel(value))}
          </button>
        ))}
      </nav>
      {decision ? (
        <Card className="admin-store-danger-panel">
          <div>
            <strong>
              {t("admin.community.confirmation", {
                action: t(actionLabel(decision.value)),
                name: decision.submission.name,
              })}
            </strong>
            <p>{t("admin.community.actionDescription")}</p>
          </div>
          <label className="sb-field">
            <span>{t("admin.moderation.reason")}</span>
            <textarea
              rows={3}
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="admin-store-danger-panel__actions">
            <Button
              type="button"
              variant={["REJECT", "REMOVE"].includes(decision.value) ? "danger" : "secondary"}
              loading={busyId === decision.submission.id}
              disabled={reason.trim().length < 3}
              onClick={() => void submitDecision()}
            >
              {t("admin.community.confirm", { action: t(actionLabel(decision.value)) })}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={Boolean(busyId)}
              onClick={() => {
                setDecision(null);
                setReason("");
              }}
            >
              {t("admin.moderation.cancel")}
            </Button>
          </div>
        </Card>
      ) : null}
      {loading ? <Card className="product-empty-state">{t("admin.community.loading")}</Card> : null}
      {!loading && submissions.length ? (
        <div className="admin-store-cosmetic-grid">
          {submissions.map((submission) => {
            const config = configFromJson(submission.configJson);
            const preview = previewInput(submission.type, config);
            return (
              <Card key={submission.id} className="admin-store-cosmetic-card">
                {preview ? (
                  <CosmeticPreview
                    cosmetic={preview}
                    name={submission.name}
                    visual={config.visual}
                    communityStyles={
                      typeof config.communityCss === "string" && config.communityCosmeticId
                        ? [{ id: config.communityCosmeticId, css: config.communityCss }]
                        : undefined
                    }
                    compact
                    className="admin-store-community-preview"
                  />
                ) : (
                  <div className="admin-store-cosmetic-preview admin-store-community-preview">
                    {t(typeLabel(submission.type))}
                  </div>
                )}
                <div className="admin-store-cosmetic-card__body">
                  <div className="admin-store-cosmetic-card__title">
                    <div>
                      <span className="product-eyebrow">
                        {t(stateLabel(submission.communityState))}
                      </span>
                      <h3>{submission.name}</h3>
                    </div>
                    <span className="product-search-count">
                      {t(moderationLabel(submission.moderationState))}
                    </span>
                  </div>
                  <p>{submission.description}</p>
                  <div className="admin-store-metric-row">
                    <span>
                      {t("admin.community.createdBy", { username: submission.submittedByUsername })}
                    </span>
                    <span>{t("admin.community.points", { count: submission.pricePoints })}</span>
                  </div>
                  {submission.reviewNote ? (
                    <p className="admin-store-capability-note">
                      {t("admin.community.review", { note: submission.reviewNote })}
                    </p>
                  ) : null}
                  <div className="admin-store-card-actions">
                    {actionsFor(submission).map((value) => (
                      <Button
                        key={value}
                        type="button"
                        size="sm"
                        variant={["REJECT", "REMOVE"].includes(value) ? "danger" : "secondary"}
                        onClick={() => {
                          setDecision({ submission, value });
                          setReason("");
                        }}
                      >
                        {t(actionLabel(value))}
                      </Button>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : !loading ? (
        <Card className="product-empty-state">{t("admin.community.empty")}</Card>
      ) : null}
    </section>
  );
}

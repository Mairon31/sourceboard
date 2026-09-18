import { useMemo, useState } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";
import type { ModerationAction } from "../../worker/moderation/service";
import type { MessageKey } from "../i18n";
import { createModerationService } from "../../worker/moderation/service";
import { AdminActionMenu } from "../components/admin/AdminActionMenu";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { useI18n } from "../i18n/I18nProvider";
import { Button, Modal, OverlayActionRow, Textarea } from "../components/ui";
import { requireModerationPageAccess } from "../data/admin-access";
import { readCsrfToken } from "../data/csrf";
import type { ServerLoaderArgs } from "../data/server-request";

const POST_ACTIONS = [
  "HIDE",
  "RESTORE",
  "LOCK",
  "UNLOCK",
  "REVOKE_SOURCE_VERIFICATION",
  "MARK_NSFW",
  "UNMARK_NSFW",
] as const satisfies readonly ModerationAction[];
const COMMENT_ACTIONS = ["HIDE", "RESTORE"] as const satisfies readonly ModerationAction[];
const USER_ACTIONS = [
  "POSTING_RESTRICTION",
  "COMMENT_RESTRICTION",
  "SUSPEND",
  "BAN",
] as const satisfies readonly ModerationAction[];
const TEMPORARY_ACTIONS = new Set<ModerationAction>([
  "POSTING_RESTRICTION",
  "COMMENT_RESTRICTION",
  "SUSPEND",
]);

export async function loader({ request, context }: ServerLoaderArgs) {
  const { runtime } = await requireModerationPageAccess(request, context);
  const searchParams = new URL(request.url).searchParams;
  const target = searchParams.get("target");
  const targetId = searchParams.get("targetId")?.trim();
  return {
    queue: await createModerationService(runtime.db).listQueue(),
    focusTarget:
      target === "POST" || target === "COMMENT" || target === "USER"
        ? targetId
          ? { targetType: target, targetId }
          : null
        : null,
  };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;
type QueueReport = LoaderData["queue"][number];
type ActionTarget = "POST" | "COMMENT" | "USER";

interface SelectedAction {
  targetType: ActionTarget;
  targetId: string;
  action: ModerationAction;
}

function actionsForTarget(targetType: string): readonly ModerationAction[] {
  if (targetType === "POST") return POST_ACTIONS;
  if (targetType === "COMMENT") return COMMENT_ACTIONS;
  if (targetType === "USER") return USER_ACTIONS;
  return [];
}

const ACTION_LABEL_KEYS: Partial<Record<ModerationAction, MessageKey>> = {
  WARN: "admin.moderation.actionWarn",
  HIDE: "admin.moderation.actionHide",
  RESTORE: "admin.moderation.actionRestore",
  LOCK: "admin.moderation.actionLock",
  UNLOCK: "admin.moderation.actionUnlock",
  POSTING_RESTRICTION: "admin.moderation.actionPostingRestriction",
  COMMENT_RESTRICTION: "admin.moderation.actionCommentRestriction",
  SUSPEND: "admin.moderation.actionSuspend",
  BAN: "admin.moderation.actionBan",
  REVOKE_SOURCE_VERIFICATION: "admin.moderation.actionRevokeSourceVerification",
  MARK_NSFW: "admin.moderation.actionMarkNsfw",
  UNMARK_NSFW: "admin.moderation.actionUnmarkNsfw",
};

function actionLabel(action: ModerationAction, translate: (key: MessageKey) => string): string {
  const key = ACTION_LABEL_KEYS[action];
  return key ? translate(key) : action;
}

function targetLabel(targetType: ActionTarget, translate: (key: MessageKey) => string): string {
  const key =
    targetType === "POST"
      ? "admin.moderation.targetPost"
      : targetType === "COMMENT"
        ? "admin.moderation.targetComment"
        : "admin.moderation.targetUser";
  return translate(key);
}

export default function AdminModerationRoute() {
  const { queue, focusTarget } = useLoaderData<LoaderData>();
  const { t, date } = useI18n();
  const revalidator = useRevalidator();
  const [search, setSearch] = useState(focusTarget?.targetId ?? "");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [targetFilter, setTargetFilter] = useState(focusTarget?.targetType ?? "ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sortOrder, setSortOrder] = useState<"NEWEST" | "OLDEST">("OLDEST");
  const [selectedAction, setSelectedAction] = useState<SelectedAction | null>(null);
  const [selectedReport, setSelectedReport] = useState<QueueReport | null>(null);
  const [reason, setReason] = useState("");
  const [durationMs, setDurationMs] = useState("86400000");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const visibleQueue = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return [...queue]
      .filter((report) => {
        if (!normalizedSearch) return true;
        return [
          report.id,
          report.targetId,
          report.reporterUsername,
          report.reportedUsername,
          report.postTitle,
          report.commentBody,
          report.detail,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .filter((report) => statusFilter === "ALL" || String(report.status) === statusFilter)
      .filter((report) => targetFilter === "ALL" || String(report.targetType) === targetFilter)
      .filter((report) => categoryFilter === "ALL" || String(report.category) === categoryFilter)
      .sort((a, b) => {
        const delta = Number(a.createdAt) - Number(b.createdAt);
        return sortOrder === "OLDEST" ? delta : -delta;
      });
  }, [categoryFilter, queue, search, sortOrder, statusFilter, targetFilter]);

  function beginAction(report: QueueReport, action: ModerationAction) {
    const targetType = String(report.targetType);
    if (targetType !== "POST" && targetType !== "COMMENT" && targetType !== "USER") return;
    setSelectedAction({ targetType, targetId: String(report.targetId), action });
    setReason("");
    setDurationMs("86400000");
    setActionError(null);
    setFeedback(null);
  }

  async function submitAction() {
    if (!selectedAction || busy) return;
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 3) {
      setActionError(t("admin.moderation.reasonMin"));
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      const includeDuration = TEMPORARY_ACTIONS.has(selectedAction.action);
      const response = await fetch("/api/admin/moderation/action", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": readCsrfToken(),
        },
        body: JSON.stringify({
          ...selectedAction,
          reason: normalizedReason,
          ...(includeDuration ? { durationMs: Number(durationMs) } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setActionError(payload?.error?.message ?? t("admin.moderation.actionFailed"));
        return;
      }
      setFeedback(
        t("admin.moderation.actionApplied", {
          action: actionLabel(selectedAction.action, t),
          target: targetLabel(selectedAction.targetType, t),
        }),
      );
      setSelectedAction(null);
      setReason("");
      revalidator.revalidate();
    } catch {
      setActionError(t("admin.moderation.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  function formatReportDate(report: QueueReport): string {
    return date(Number(report.createdAt), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    });
  }

  function actionMenu(report: QueueReport) {
    const actions = actionsForTarget(String(report.targetType));
    if (!actions.length)
      return <span className="product-search-count">{t("admin.moderation.noDirectActions")}</span>;
    return (
      <AdminActionMenu
        label={t("admin.moderation.actions")}
        items={actions.map((action) => ({
          label: actionLabel(action, t),
          onSelect: () => beginAction(report, action),
        }))}
      />
    );
  }

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow={t("admin.moderation.eyebrow")}
        title={t("admin.moderation.title")}
        description={t("admin.moderation.description")}
      />

      <section className="admin-section">
        <div className="admin-filter-bar" aria-label={t("admin.moderation.filters")}>
          <label className="sb-field admin-filter-control admin-filter-control--search">
            <span className="sb-field__label">{t("admin.moderation.search")}</span>
            <input
              className="sb-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("admin.moderation.searchPlaceholder")}
            />
          </label>
          <label className="sb-field admin-filter-control">
            <span className="sb-field__label">{t("admin.moderation.status")}</span>
            <select
              className="sb-input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">{t("admin.moderation.allOpen")}</option>
              <option value="OPEN">{t("admin.moderation.open")}</option>
              <option value="IN_REVIEW">{t("admin.moderation.inReview")}</option>
            </select>
          </label>
          <label className="sb-field admin-filter-control">
            <span className="sb-field__label">{t("admin.moderation.target")}</span>
            <select
              className="sb-input"
              value={targetFilter}
              onChange={(event) => setTargetFilter(event.target.value)}
            >
              <option value="ALL">{t("admin.moderation.allTargets")}</option>
              <option value="POST">{t("admin.moderation.posts")}</option>
              <option value="COMMENT">{t("admin.moderation.comments")}</option>
              <option value="USER">{t("admin.moderation.users")}</option>
              <option value="SOURCE">{t("admin.moderation.sources")}</option>
            </select>
          </label>
          <label className="sb-field admin-filter-control">
            <span className="sb-field__label">{t("admin.moderation.category")}</span>
            <select
              className="sb-input"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="ALL">{t("admin.moderation.allCategories")}</option>
              <option value="SPAM">{t("admin.moderation.spam")}</option>
              <option value="HARASSMENT">{t("admin.moderation.harassment")}</option>
              <option value="MISLEADING_SOURCE">{t("admin.moderation.misleadingSource")}</option>
              <option value="NSFW">{t("admin.moderation.nsfw")}</option>
              <option value="PRIVACY">{t("admin.moderation.privacy")}</option>
              <option value="COPYRIGHT">{t("admin.moderation.copyright")}</option>
              <option value="OTHER">{t("admin.moderation.other")}</option>
            </select>
          </label>
          <label className="sb-field admin-filter-control">
            <span className="sb-field__label">{t("admin.moderation.sort")}</span>
            <select
              className="sb-input"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as "NEWEST" | "OLDEST")}
            >
              <option value="OLDEST">{t("admin.moderation.oldest")}</option>
              <option value="NEWEST">{t("admin.moderation.newest")}</option>
            </select>
          </label>
          <span className="product-search-count">
            {t("admin.moderation.reportCount", { count: visibleQueue.length })}
          </span>
        </div>

        {feedback ? (
          <div className="product-presentation-notice" role="status">
            {feedback}
          </div>
        ) : null}

        {visibleQueue.length ? (
          <>
            <div className="admin-table admin-desktop-table" role="table">
              <div className="admin-table__row admin-table__row--header" role="row">
                <span>{t("admin.moderation.context")}</span>
                <span>{t("admin.moderation.reporter")}</span>
                <span>{t("admin.moderation.reason")}</span>
                <span>{t("admin.moderation.resource")}</span>
                <span>{t("admin.moderation.details")}</span>
              </div>
              {visibleQueue.map((report) => (
                <div className="admin-table__row" role="row" key={String(report.id)}>
                  <div className="admin-table__copy">
                    <strong>{report.postTitle ?? String(report.targetType)}</strong>
                    <span>{report.commentBody ?? String(report.targetId)}</span>
                    <span>{report.reportedUsername ?? "—"}</span>
                  </div>
                  <div className="admin-table__copy">
                    <span>{report.reporterUsername ?? report.reporterUserId}</span>
                    <span>
                      {String(report.targetType)} · {String(report.category)}
                    </span>
                  </div>
                  <div className="admin-table__copy">
                    <span className="admin-status-badge">{String(report.status)}</span>
                    {report.detail ? <span>{String(report.detail)}</span> : null}
                  </div>
                  <span>{formatReportDate(report)}</span>
                  <div className="admin-action-cell">
                    {report.resourceUrl ? (
                      <Link className="admin-report-link" to={report.resourceUrl}>
                        {t("common.view")}
                      </Link>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => setSelectedReport(report)}>
                      {t("admin.moderation.details")}
                    </Button>
                    {actionMenu(report)}
                  </div>
                </div>
              ))}
            </div>

            <div className="admin-mobile-card-list">
              {visibleQueue.map((report) => (
                <article className="admin-mobile-review-card admin-surface" key={String(report.id)}>
                  <div className="admin-mobile-review-card__row">
                    <div className="admin-table__copy">
                      <strong>{report.postTitle ?? String(report.targetType)}</strong>
                      <span>{report.reportedUsername ?? report.targetId}</span>
                    </div>
                    <span className="admin-status-badge">{String(report.status)}</span>
                  </div>
                  <div className="admin-table__copy">
                    <span>
                      {t("admin.moderation.reporter")}:{" "}
                      {report.reporterUsername ?? report.reporterUserId}
                    </span>
                    <span>{report.commentBody ?? report.detail ?? "—"}</span>
                  </div>
                  <div className="product-chip-row">
                    <span className="admin-status-badge">{String(report.category)}</span>
                    <span className="product-search-count">{formatReportDate(report)}</span>
                  </div>
                  <div className="admin-action-cell">
                    {report.resourceUrl ? (
                      <Link className="admin-report-link" to={report.resourceUrl}>
                        {t("common.view")}
                      </Link>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => setSelectedReport(report)}>
                      {t("admin.moderation.details")}
                    </Button>
                    {actionMenu(report)}
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="product-empty-state">{t("admin.moderation.noMatch")}</p>
        )}
      </section>

      {selectedReport ? (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) setSelectedReport(null);
          }}
          title={t("admin.moderation.detailsTitle")}
          description={t("admin.moderation.detailsDescription")}
        >
          <div className="admin-report-details">
            <dl>
              <div>
                <dt>{t("admin.moderation.reporter")}</dt>
                <dd>{selectedReport.reporterUsername ?? selectedReport.reporterUserId}</dd>
              </div>
              <div>
                <dt>{t("admin.moderation.reported")}</dt>
                <dd>{selectedReport.reportedUsername ?? selectedReport.reportedUserId ?? "—"}</dd>
              </div>
              <div>
                <dt>{t("admin.moderation.context")}</dt>
                <dd>{selectedReport.postTitle ?? selectedReport.targetId}</dd>
              </div>
              <div>
                <dt>{t("admin.moderation.reason")}</dt>
                <dd>{selectedReport.detail ?? "—"}</dd>
              </div>
              <div>
                <dt>{t("admin.moderation.resource")}</dt>
                <dd>
                  {selectedReport.resourceUrl ? (
                    <Link to={selectedReport.resourceUrl}>
                      {t("admin.moderation.openResource")}
                    </Link>
                  ) : (
                    t("admin.moderation.noResource")
                  )}
                </dd>
              </div>
            </dl>
            {selectedReport.commentBody ? (
              <p className="admin-report-details__body">{selectedReport.commentBody}</p>
            ) : null}
            <section>
              <h3>{t("admin.moderation.history")}</h3>
              {selectedReport.moderationHistory.length ? (
                <ol>
                  {selectedReport.moderationHistory.map((entry) => (
                    <li key={entry.id}>
                      <strong>{entry.action}</strong>
                      <span>
                        {entry.actorUsername ?? entry.actorUserId ?? "—"} ·{" "}
                        {formatReportDate({
                          ...selectedReport,
                          createdAt: entry.createdAt,
                        })}
                      </span>
                      {entry.reason ? <span>{entry.reason}</span> : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>{t("admin.moderation.noHistory")}</p>
              )}
            </section>
            <OverlayActionRow>
              <Button variant="ghost" onClick={() => setSelectedReport(null)}>
                {t("common.close")}
              </Button>
            </OverlayActionRow>
          </div>
        </Modal>
      ) : null}

      {selectedAction ? (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open && !busy) setSelectedAction(null);
          }}
          title={t("admin.moderation.actionTitle", {
            action: actionLabel(selectedAction.action, t),
            target: targetLabel(selectedAction.targetType, t),
          })}
          description={t("admin.moderation.targetDescription", { target: selectedAction.targetId })}
        >
          <div className="product-form-card">
            <Textarea
              label={t("admin.moderation.reason")}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={actionError ?? undefined}
              placeholder={t("admin.moderation.reasonPlaceholder")}
              maxLength={2000}
              rows={5}
              autoFocus
            />
            {TEMPORARY_ACTIONS.has(selectedAction.action) ? (
              <label className="sb-field admin-filter-control">
                <span className="sb-field__label">{t("admin.moderation.duration")}</span>
                <select
                  className="sb-input"
                  value={durationMs}
                  onChange={(event) => setDurationMs(event.target.value)}
                >
                  <option value="3600000">{t("admin.moderation.oneHour")}</option>
                  <option value="86400000">{t("admin.moderation.oneDay")}</option>
                  <option value="604800000">{t("admin.moderation.sevenDays")}</option>
                  <option value="2592000000">{t("admin.moderation.thirtyDays")}</option>
                </select>
              </label>
            ) : null}
            <OverlayActionRow>
              <Button variant="ghost" disabled={busy} onClick={() => setSelectedAction(null)}>
                {t("admin.moderation.cancel")}
              </Button>
              <Button loading={busy} onClick={() => void submitAction()}>
                {t("admin.moderation.applyAction")}
              </Button>
            </OverlayActionRow>
          </div>
        </Modal>
      ) : null}
    </AdminShell>
  );
}

import { useMemo, useState } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { useI18n } from "../i18n/I18nProvider";
import { SourceDisputeCard } from "../components/admin/SourceDisputeCard";
import { Badge, Button, Card, Checkbox, Input, Textarea } from "../components/ui";
import { readCsrfToken } from "../data/csrf";
import type { loader as adminVerificationsLoader } from "./admin-verifications-gated";

type IntegrityView = "review" | "verified" | "disputes" | "history";

interface Candidate {
  postId: string;
  postSlug: string | null;
  postTitle: string;
  commentId: string;
  commentBody: string;
  authorLabel: string;
  acceptedAt: number | null;
  canonicalSourceUrl: string | null;
}

interface VerifiedSource {
  resolutionId: string;
  postId: string;
  postSlug: string | null;
  postTitle: string;
  commentId: string;
  authorLabel: string;
  canonicalSourceUrl: string;
  evidenceNote: string | null;
  evidenceNotePublic: number;
  verifierLabel: string | null;
  verifiedAt: number;
}

interface IntegrityEntry {
  id: string;
  status: string;
  state: string;
  resolutionType: string;
  searchText: string;
}

function postHref(postId: string, postSlug: string | null): string {
  return postSlug
    ? `/posts/${encodeURIComponent(postId)}/${encodeURIComponent(postSlug)}`
    : `/posts/${encodeURIComponent(postId)}`;
}

function formatDate(value: number | null, unknownLabel: string): string {
  if (value === null) return unknownLabel;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function IntegrityTabs({ view }: { view: IntegrityView }) {
  const { t } = useI18n();
  const tabs: Array<{ value: IntegrityView; label: string }> = [
    { value: "review", label: t("admin.source.integrity.review") },
    { value: "verified", label: t("admin.source.integrity.verified") },
    { value: "disputes", label: t("admin.source.integrity.disputes") },
    { value: "history", label: t("admin.source.integrity.history") },
  ];
  return (
    <nav className="admin-integrity-tabs" aria-label={t("admin.source.integrity.views")}>
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          to={`/admin/source-integrity?view=${tab.value}`}
          className={
            view === tab.value
              ? "admin-integrity-tab admin-integrity-tab--active"
              : "admin-integrity-tab"
          }
          aria-current={view === tab.value ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export default function AdminVerificationsRoute() {
  const { access, canRevoke, canReviewDisputes, view, candidates, verified, disputes, history } =
    useLoaderData<typeof adminVerificationsLoader>();
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const integrityEntries = useMemo<IntegrityEntry[]>(
    () => [
      ...candidates.map((candidate) => ({
        id: candidate.commentId,
        status: "ACCEPTED",
        state: "ACTIVE",
        resolutionType: "ACCEPTED",
        searchText: [
          candidate.postTitle,
          candidate.commentBody,
          candidate.authorLabel,
          candidate.canonicalSourceUrl,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      })),
      ...verified.map((source) => ({
        id: source.resolutionId,
        status: "VERIFIED",
        state: "ACTIVE",
        resolutionType: "VERIFIED",
        searchText: [
          source.postTitle,
          source.authorLabel,
          source.canonicalSourceUrl,
          source.evidenceNote,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      })),
      ...disputes.map((dispute) => ({
        id: dispute.reportId,
        status: dispute.status,
        state: dispute.status,
        resolutionType: "",
        searchText: [
          dispute.reportId,
          dispute.targetId,
          dispute.category,
          dispute.detail,
          dispute.postTitle,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      })),
      ...history.map((entry) => ({
        id: entry.id,
        status: entry.state,
        state: entry.state,
        resolutionType: entry.resolutionType,
        searchText: [
          entry.id,
          entry.postId,
          entry.postTitle,
          entry.canonicalSourceUrl,
          entry.actorLabel,
          entry.revokedByLabel,
          entry.revokeReason,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      })),
    ],
    [candidates, disputes, history, verified],
  );
  const statusOptions = useMemo(
    () => [...new Set(integrityEntries.map((entry) => entry.status))].filter(Boolean),
    [integrityEntries],
  );
  const activeStatusFilter = statusOptions.includes(statusFilter) ? statusFilter : "ALL";
  const visibleEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return integrityEntries.filter((entry) => {
      const matchesStatus = activeStatusFilter === "ALL" || entry.status === activeStatusFilter;
      const matchesSearch =
        !normalizedSearch ||
        [entry.searchText, entry.state, entry.resolutionType]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    });
  }, [activeStatusFilter, integrityEntries, search]);
  const visibleIds = useMemo(
    () => new Set(visibleEntries.map((entry) => entry.id)),
    [visibleEntries],
  );
  const visibleCandidates = candidates.filter((candidate) => visibleIds.has(candidate.commentId));
  const visibleVerified = verified.filter((source) => visibleIds.has(source.resolutionId));
  const visibleDisputes = disputes.filter((dispute) => visibleIds.has(dispute.reportId));
  const visibleHistory = history.filter((entry) => visibleIds.has(entry.id));
  const hasActiveFilters = Boolean(search.trim()) || activeStatusFilter !== "ALL";

  if (!access.authorized) {
    return (
      <AdminShell>
        <AdminPageHeader
          eyebrow={t("admin.source.integrity.restrictedEyebrow")}
          title={t("admin.source.integrity.restrictedTitle")}
          description={t("admin.source.integrity.restrictedDescription")}
        />
        <Card className="product-empty-state">{t("admin.source.integrity.signInRequired")}</Card>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow={t("admin.source.integrity.eyebrow")}
        title={t("admin.source.integrity.title")}
        description={t("admin.source.integrity.description")}
      />
      <IntegrityTabs view={view} />
      <section className="admin-integrity-toolbar" aria-label={t("admin.source.integrity.search")}>
        <label className="sb-field admin-integrity-toolbar__search">
          <span className="sb-field__label">{t("admin.source.integrity.search")}</span>
          <input
            className="sb-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("admin.source.integrity.searchPlaceholder")}
          />
        </label>
        <label className="sb-field admin-integrity-toolbar__status">
          <span className="sb-field__label">{t("admin.source.integrity.statusFilter")}</span>
          <select
            className="sb-input"
            value={activeStatusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">{t("admin.source.integrity.allStatuses")}</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <span className="product-search-count">
          {t("admin.source.integrity.resultCount", { count: visibleEntries.length })}
        </span>
      </section>
      <section className="admin-section admin-integrity-results">
        {view === "review" ? (
          visibleCandidates.length ? (
            visibleCandidates.map((candidate) => (
              <VerificationCandidate key={candidate.commentId} candidate={candidate} />
            ))
          ) : (
            <Card className="product-empty-state admin-surface">
              {hasActiveFilters
                ? t("admin.source.integrity.noMatch")
                : t("admin.source.integrity.noReview")}
            </Card>
          )
        ) : null}

        {view === "verified" ? (
          visibleVerified.length ? (
            <div className="admin-integrity-list">
              {visibleVerified.map((source) => (
                <VerifiedSourceCard
                  key={source.resolutionId}
                  source={source}
                  canEdit={access.authorized}
                  canRevoke={canRevoke}
                />
              ))}
            </div>
          ) : (
            <Card className="product-empty-state admin-surface">
              {hasActiveFilters
                ? t("admin.source.integrity.noMatch")
                : t("admin.source.integrity.noVerified")}
            </Card>
          )
        ) : null}

        {view === "disputes" ? (
          visibleDisputes.length ? (
            <div className="admin-integrity-list">
              {visibleDisputes.map((dispute) => (
                <SourceDisputeCard
                  key={dispute.reportId}
                  dispute={dispute}
                  canReview={canReviewDisputes}
                />
              ))}
            </div>
          ) : (
            <Card className="product-empty-state admin-surface">
              {hasActiveFilters
                ? t("admin.source.integrity.noMatch")
                : t("admin.source.integrity.noDisputes")}
            </Card>
          )
        ) : null}

        {view === "history" ? (
          visibleHistory.length ? (
            <div className="admin-integrity-history">
              {visibleHistory.map((entry) => (
                <div className="admin-integrity-history__row" key={entry.id}>
                  <div className="product-chip-row">
                    <Badge>{entry.resolutionType}</Badge>
                    <Badge>{entry.state}</Badge>
                  </div>
                  <div>
                    <strong>{entry.postTitle}</strong>
                    <span>
                      {entry.actorLabel
                        ? `@${entry.actorLabel}`
                        : t("admin.source.integrity.system")}{" "}
                      · {formatDate(entry.createdAt, t("admin.source.integrity.unknown"))}
                    </span>
                    {entry.revokedAt ? (
                      <small>
                        {t("admin.source.integrity.revokedAt", {
                          date: formatDate(entry.revokedAt, t("admin.source.integrity.unknown")),
                        })}
                        {entry.revokedByLabel
                          ? ` ${t("admin.source.integrity.revokedBy", {
                              username: entry.revokedByLabel,
                            })}`
                          : ""}
                        {entry.revokeReason
                          ? ` ${t("admin.source.integrity.reasonDetail", {
                              reason: entry.revokeReason,
                            })}`
                          : ""}
                      </small>
                    ) : null}
                  </div>
                  <div className="admin-integrity-actions">
                    <Link
                      className="product-text-action"
                      to={postHref(entry.postId, entry.postSlug)}
                    >
                      {t("admin.source.integrity.openPost")}
                    </Link>
                    {entry.canonicalSourceUrl ? (
                      <a
                        className="product-text-action"
                        href={entry.canonicalSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t("admin.source.integrity.openSource")}
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card className="product-empty-state admin-surface">
              {hasActiveFilters
                ? t("admin.source.integrity.noMatch")
                : t("admin.source.integrity.noHistory")}
            </Card>
          )
        ) : null}
      </section>
    </AdminShell>
  );
}

function VerificationCandidate({ candidate }: { candidate: Candidate }) {
  const { t } = useI18n();
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(
        `/api/posts/${encodeURIComponent(candidate.postId)}/source/verify`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": readCsrfToken(),
          },
          body: JSON.stringify({
            commentId: candidate.commentId,
            canonicalSourceUrl: form.get("url"),
            evidenceNote: form.get("evidence"),
            showEvidenceNote: form.get("showEvidenceNote") === "true",
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setStatus(payload?.error?.message ?? t("admin.source.integrity.verifyFailed"));
        return;
      }
      formElement.reset();
      setStatus(t("admin.source.integrity.verifySucceeded"));
      revalidator.revalidate();
    } catch {
      setStatus(t("admin.source.integrity.verifyFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="admin-verification-card admin-surface">
      <div className="admin-verification-card__context">
        <div className="product-chip-row">
          <Badge>{t("admin.source.integrity.acceptedSource")}</Badge>
          <span className="admin-status-badge">@{candidate.authorLabel}</span>
        </div>
        <div className="admin-verification-card__copy">
          <h2>{candidate.postTitle}</h2>
          <p>{candidate.commentBody}</p>
          <small>
            {t("admin.source.integrity.acceptedAt", {
              date: formatDate(candidate.acceptedAt, t("admin.source.integrity.unknown")),
            })}
          </small>
        </div>
        <div className="admin-integrity-actions">
          {candidate.canonicalSourceUrl ? (
            <a
              className="product-text-action"
              href={candidate.canonicalSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("admin.source.integrity.openSource")}
            </a>
          ) : null}
          <Link
            className="product-text-action"
            to={postHref(candidate.postId, candidate.postSlug)}
            target="_blank"
            rel="noreferrer"
          >
            {t("admin.source.integrity.openPost")}
          </Link>
        </div>
      </div>

      <form className="admin-verification-card__decision" onSubmit={(event) => void verify(event)}>
        <div>
          <span className="product-eyebrow">{t("admin.source.integrity.decision")}</span>
          <h3>{t("admin.source.integrity.verifyTitle")}</h3>
          <p>{t("admin.source.integrity.verifyDescription")}</p>
        </div>
        <Input
          name="url"
          label={t("admin.source.integrity.canonicalUrl")}
          type="url"
          defaultValue={candidate.canonicalSourceUrl ?? ""}
          required
        />
        <Textarea
          name="evidence"
          label={t("admin.source.integrity.evidenceNote")}
          required
          minLength={10}
          maxLength={500}
          rows={4}
        />
        <Checkbox
          name="showEvidenceNote"
          value="true"
          label={t("admin.source.integrity.showEvidenceNote")}
          description={t("admin.source.integrity.showEvidenceNoteDescription")}
        />
        <Button type="submit" loading={busy}>
          {t("admin.source.integrity.verifyAction")}
        </Button>
        {status ? <small role="status">{status}</small> : null}
      </form>
    </Card>
  );
}

function VerifiedSourceCard({
  source,
  canEdit,
  canRevoke,
}: {
  source: VerifiedSource;
  canEdit: boolean;
  canRevoke: boolean;
}) {
  const { t } = useI18n();
  const revalidator = useRevalidator();
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    url: source.canonicalSourceUrl,
    evidence: source.evidenceNote ?? "",
    showEvidenceNote: source.evidenceNotePublic === 1,
  });
  const [busy, setBusy] = useState(false);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [revokeStatus, setRevokeStatus] = useState<string | null>(null);

  function beginEdit() {
    setEditValues({
      url: source.canonicalSourceUrl,
      evidence: source.evidenceNote ?? "",
      showEvidenceNote: source.evidenceNotePublic === 1,
    });
    setEditStatus(null);
    setEditing(true);
  }

  async function update(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setEditStatus(null);
    try {
      const response = await fetch(
        `/api/posts/${encodeURIComponent(source.postId)}/source/update`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify({
            resolutionId: source.resolutionId,
            commentId: source.commentId,
            canonicalSourceUrl: form.get("url"),
            evidenceNote: form.get("evidence"),
            showEvidenceNote: form.get("showEvidenceNote") === "true",
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setEditStatus(payload?.error?.message ?? t("admin.source.integrity.updateFailed"));
        return;
      }
      setEditStatus(t("admin.source.integrity.updateSucceeded"));
      setEditing(false);
      revalidator.revalidate();
    } catch {
      setEditStatus(t("admin.source.integrity.updateFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!canRevoke || reason.trim().length < 3) return;
    setBusy(true);
    setRevokeStatus(null);
    try {
      const response = await fetch("/api/admin/moderation/action", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({
          targetType: "POST",
          targetId: source.postId,
          action: "REVOKE_SOURCE_VERIFICATION",
          reason: reason.trim(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setRevokeStatus(payload?.error?.message ?? t("admin.source.integrity.revokeFailed"));
        return;
      }
      setRevokeStatus(t("admin.source.integrity.revokeSucceeded"));
      setReason("");
      revalidator.revalidate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="admin-integrity-card admin-surface">
      <div className="admin-integrity-card__header">
        <div>
          <div className="product-chip-row">
            <Badge>{t("admin.source.integrity.verifiedLabel")}</Badge>
            <Badge tone={source.evidenceNotePublic === 1 ? "success" : "neutral"}>
              {source.evidenceNotePublic === 1
                ? t("admin.source.integrity.evidenceNoteVisible")
                : t("admin.source.integrity.evidenceNoteHidden")}
            </Badge>
            <span className="admin-status-badge">@{source.authorLabel}</span>
          </div>
          <h2>{source.postTitle}</h2>
        </div>
        <span className="product-search-count">
          {formatDate(source.verifiedAt, t("admin.source.integrity.unknown"))}
        </span>
      </div>
      <a
        href={source.canonicalSourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="admin-integrity-source-url"
      >
        {source.canonicalSourceUrl}
      </a>
      {source.evidenceNote ? <p>{source.evidenceNote}</p> : null}
      <small>
        {source.verifierLabel
          ? t("admin.source.integrity.verifiedBy", { username: source.verifierLabel })
          : t("admin.source.integrity.verifierUnavailable")}
      </small>
      <div className="admin-card-actions admin-integrity-actions">
        <Link className="product-text-action" to={postHref(source.postId, source.postSlug)}>
          {t("admin.source.integrity.openPost")}
        </Link>
        {canEdit ? (
          <Button variant="secondary" size="sm" onClick={beginEdit} disabled={busy}>
            {t("admin.source.integrity.editAction")}
          </Button>
        ) : null}
      </div>
      {editing ? (
        <form className="admin-integrity-edit" onSubmit={(event) => void update(event)}>
          <div>
            <span className="product-eyebrow">{t("admin.source.integrity.editTitle")}</span>
            <p>{t("admin.source.integrity.editDescription")}</p>
          </div>
          <Input
            name="url"
            label={t("admin.source.integrity.canonicalUrl")}
            type="url"
            defaultValue={editValues.url}
            required
          />
          <Textarea
            name="evidence"
            label={t("admin.source.integrity.evidenceNote")}
            defaultValue={editValues.evidence}
            required
            minLength={10}
            maxLength={500}
            rows={4}
          />
          <Checkbox
            name="showEvidenceNote"
            value="true"
            defaultChecked={editValues.showEvidenceNote}
            label={t("admin.source.integrity.showEvidenceNote")}
            description={t("admin.source.integrity.showEvidenceNoteDescription")}
          />
          <div className="admin-integrity-actions">
            <Button type="submit" loading={busy}>
              {t("admin.source.integrity.updateAction")}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setEditStatus(null);
              }}
            >
              {t("admin.source.integrity.cancelEdit")}
            </Button>
          </div>
          {editStatus ? <small role="status">{editStatus}</small> : null}
        </form>
      ) : null}
      {editStatus && !editing ? <small role="status">{editStatus}</small> : null}
      {canRevoke ? (
        <div className="admin-integrity-revoke">
          <Textarea
            label={t("admin.source.integrity.revocationReason")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            maxLength={500}
          />
          <Button
            variant="danger"
            disabled={reason.trim().length < 3}
            loading={busy}
            onClick={() => void revoke()}
          >
            {t("admin.source.integrity.revokeAction")}
          </Button>
          {revokeStatus ? <small role="status">{revokeStatus}</small> : null}
        </div>
      ) : null}
    </Card>
  );
}

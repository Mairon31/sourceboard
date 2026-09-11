import { useState } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { SourceDisputeCard } from "../components/admin/SourceDisputeCard";
import { Badge, Button, Card, Input, Textarea } from "../components/ui";
import { loadCapabilityAccess } from "../data/capability-access";
import { readCsrfToken } from "../data/csrf";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

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
  verifierLabel: string | null;
  verifiedAt: number;
}

interface SourceDispute {
  reportId: string;
  targetId: string;
  category: string;
  detail: string | null;
  status: string;
  postId: string | null;
  postSlug: string | null;
  postTitle: string | null;
  createdAt: number;
}

interface ResolutionHistory {
  id: string;
  postId: string;
  postSlug: string | null;
  postTitle: string;
  resolutionType: string;
  state: string;
  canonicalSourceUrl: string | null;
  actorLabel: string | null;
  revokedByLabel: string | null;
  revokeReason: string | null;
  createdAt: number;
  revokedAt: number | null;
}

function integrityView(value: string | null): IntegrityView {
  return value === "verified" || value === "disputes" || value === "history" ? value : "review";
}

function postHref(postId: string, postSlug: string | null): string {
  return postSlug
    ? `/posts/${encodeURIComponent(postId)}/${encodeURIComponent(postSlug)}`
    : `/posts/${encodeURIComponent(postId)}`;
}

function formatDate(value: number | null): string {
  if (value === null) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

export async function loader({ request, context }: ServerLoaderArgs) {
  const view = integrityView(new URL(request.url).searchParams.get("view"));
  return withOptionalServerSession(
    request,
    context,
    () => ({
      access: { authorized: false, unavailable: false },
      canRevoke: false,
      canReviewDisputes: false,
      view,
      candidates: [] as Candidate[],
      verified: [] as VerifiedSource[],
      disputes: [] as SourceDispute[],
      history: [] as ResolutionHistory[],
    }),
    async (runtime, userId) => {
      const [access, revokeAccess, reportReviewAccess] = await Promise.all([
        loadCapabilityAccess(request, context, "source.verify"),
        loadCapabilityAccess(request, context, "source.revoke_verification"),
        loadCapabilityAccess(request, context, "report.review"),
      ]);
      if (!userId || !access.authorized) {
        return {
          access,
          canRevoke: false,
          canReviewDisputes: false,
          view,
          candidates: [] as Candidate[],
          verified: [] as VerifiedSource[],
          disputes: [] as SourceDispute[],
          history: [] as ResolutionHistory[],
        };
      }

      if (view === "review") {
        const result = await runtime.db
          .prepare(
            `SELECT p.id AS postId, p.slug AS postSlug, p.title AS postTitle,
                    c.id AS commentId, c.body_plaintext AS commentBody,
                    u.username AS authorLabel, accepted.created_at AS acceptedAt,
                    lp.canonical_url AS canonicalSourceUrl
             FROM posts p
             JOIN comments c ON c.id = p.accepted_comment_id AND c.post_id = p.id
             JOIN users u ON u.id = c.author_id
             LEFT JOIN comment_link_previews lp ON lp.comment_id = c.id
             LEFT JOIN source_resolutions accepted
               ON accepted.post_id = p.id AND accepted.comment_id = c.id
              AND accepted.resolution_type = 'ACCEPTED' AND accepted.state = 'ACTIVE'
             WHERE p.accepted_comment_id IS NOT NULL
               AND p.verified_source_id IS NULL
               AND p.deleted_at IS NULL AND p.hidden_at IS NULL
               AND c.state = 'VISIBLE' AND c.deleted_at IS NULL
             ORDER BY COALESCE(accepted.created_at, p.updated_at) ASC
             LIMIT 100`,
          )
          .all<Candidate>();
        return {
          access,
          canRevoke: revokeAccess.authorized,
          canReviewDisputes: reportReviewAccess.authorized,
          view,
          candidates: result.results,
          verified: [] as VerifiedSource[],
          disputes: [] as SourceDispute[],
          history: [] as ResolutionHistory[],
        };
      }

      if (view === "verified") {
        const result = await runtime.db
          .prepare(
            `SELECT sr.id AS resolutionId, p.id AS postId, p.slug AS postSlug,
                    p.title AS postTitle, sr.comment_id AS commentId,
                    source_author.username AS authorLabel,
                    sr.canonical_source_url AS canonicalSourceUrl,
                    sr.evidence_note AS evidenceNote,
                    verifier.username AS verifierLabel, sr.created_at AS verifiedAt
             FROM source_resolutions sr
             JOIN posts p ON p.id = sr.post_id
             JOIN comments c ON c.id = sr.comment_id
             JOIN users source_author ON source_author.id = c.author_id
             LEFT JOIN users verifier ON verifier.id = sr.actor_user_id
             WHERE sr.resolution_type = 'VERIFIED' AND sr.state = 'ACTIVE'
             ORDER BY sr.created_at DESC
             LIMIT 100`,
          )
          .all<VerifiedSource>();
        return {
          access,
          canRevoke: revokeAccess.authorized,
          canReviewDisputes: reportReviewAccess.authorized,
          view,
          candidates: [] as Candidate[],
          verified: result.results,
          disputes: [] as SourceDispute[],
          history: [] as ResolutionHistory[],
        };
      }

      if (view === "disputes") {
        const result = await runtime.db
          .prepare(
            `SELECT mr.id AS reportId, mr.target_id AS targetId, mr.category,
                    mr.detail, mr.status, p.id AS postId, p.slug AS postSlug,
                    p.title AS postTitle, mr.created_at AS createdAt
             FROM moderation_reports mr
             LEFT JOIN source_resolutions sr ON sr.id = mr.target_id
             LEFT JOIN posts p ON p.id = COALESCE(sr.post_id, mr.target_id)
             WHERE mr.target_type = 'SOURCE' AND mr.status IN ('OPEN', 'IN_REVIEW')
             ORDER BY CASE mr.status WHEN 'IN_REVIEW' THEN 0 ELSE 1 END, mr.created_at ASC
             LIMIT 100`,
          )
          .all<SourceDispute>();
        return {
          access,
          canRevoke: revokeAccess.authorized,
          canReviewDisputes: reportReviewAccess.authorized,
          view,
          candidates: [] as Candidate[],
          verified: [] as VerifiedSource[],
          disputes: result.results,
          history: [] as ResolutionHistory[],
        };
      }

      const result = await runtime.db
        .prepare(
          `SELECT sr.id, p.id AS postId, p.slug AS postSlug, p.title AS postTitle,
                  sr.resolution_type AS resolutionType, sr.state,
                  sr.canonical_source_url AS canonicalSourceUrl,
                  actor.username AS actorLabel, revoker.username AS revokedByLabel,
                  sr.revoke_reason AS revokeReason, sr.created_at AS createdAt,
                  sr.revoked_at AS revokedAt
           FROM source_resolutions sr
           JOIN posts p ON p.id = sr.post_id
           LEFT JOIN users actor ON actor.id = sr.actor_user_id
           LEFT JOIN users revoker ON revoker.id = sr.revoked_by_user_id
           ORDER BY COALESCE(sr.revoked_at, sr.created_at) DESC
           LIMIT 100`,
        )
        .all<ResolutionHistory>();
      return {
        access,
        canRevoke: revokeAccess.authorized,
        canReviewDisputes: reportReviewAccess.authorized,
        view,
        candidates: [] as Candidate[],
        verified: [] as VerifiedSource[],
        disputes: [] as SourceDispute[],
        history: result.results,
      };
    },
  );
}

function IntegrityTabs({ view }: { view: IntegrityView }) {
  const tabs: Array<{ value: IntegrityView; label: string }> = [
    { value: "review", label: "Needs review" },
    { value: "verified", label: "Verified sources" },
    { value: "disputes", label: "Disputes" },
    { value: "history", label: "History" },
  ];
  return (
    <nav className="admin-integrity-tabs" aria-label="Source integrity views">
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
    useLoaderData<typeof loader>();
  if (!access.authorized) {
    return (
      <AdminShell>
        <AdminPageHeader
          eyebrow="Restricted"
          title="Source integrity"
          description="The source.verify capability is required."
        />
        <Card className="product-empty-state">
          Sign in with an authorized source verifier account to continue.
        </Card>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="Source integrity"
        title="Accepted source integrity"
        description="Review accepted sources, preserve canonical evidence, investigate disputes and keep revocations auditable from one workflow."
      />
      <IntegrityTabs view={view} />
      <section className="admin-section">
        {view === "review" ? (
          candidates.length ? (
            candidates.map((candidate) => (
              <VerificationCandidate key={candidate.commentId} candidate={candidate} />
            ))
          ) : (
            <Card className="product-empty-state admin-surface">
              No accepted sources are waiting for review.
            </Card>
          )
        ) : null}

        {view === "verified" ? (
          verified.length ? (
            <div className="admin-integrity-list">
              {verified.map((source) => (
                <VerifiedSourceCard
                  key={source.resolutionId}
                  source={source}
                  canRevoke={canRevoke}
                />
              ))}
            </div>
          ) : (
            <Card className="product-empty-state admin-surface">No active verified sources.</Card>
          )
        ) : null}

        {view === "disputes" ? (
          disputes.length ? (
            <div className="admin-integrity-list">
              {disputes.map((dispute) => (
                <SourceDisputeCard
                  key={dispute.reportId}
                  dispute={dispute}
                  canReview={canReviewDisputes}
                />
              ))}
            </div>
          ) : (
            <Card className="product-empty-state admin-surface">No open source disputes.</Card>
          )
        ) : null}

        {view === "history" ? (
          history.length ? (
            <div className="admin-integrity-history">
              {history.map((entry) => (
                <div className="admin-integrity-history__row" key={entry.id}>
                  <div className="product-chip-row">
                    <Badge>{entry.resolutionType}</Badge>
                    <Badge>{entry.state}</Badge>
                  </div>
                  <div>
                    <strong>{entry.postTitle}</strong>
                    <span>
                      {entry.actorLabel ? `@${entry.actorLabel}` : "System"} ·{" "}
                      {formatDate(entry.createdAt)}
                    </span>
                    {entry.revokedAt ? (
                      <small>
                        Revoked {formatDate(entry.revokedAt)}
                        {entry.revokedByLabel ? ` by @${entry.revokedByLabel}` : ""}
                        {entry.revokeReason ? ` · ${entry.revokeReason}` : ""}
                      </small>
                    ) : null}
                  </div>
                  <Link className="product-text-action" to={postHref(entry.postId, entry.postSlug)}>
                    Open
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <Card className="product-empty-state admin-surface">No source resolution history.</Card>
          )
        ) : null}
      </section>
    </AdminShell>
  );
}

function VerificationCandidate({ candidate }: { candidate: Candidate }) {
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
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setStatus(payload?.error?.message ?? "Source verification could not be saved.");
        return;
      }
      formElement.reset();
      setStatus("Source verified and moved to the verified ledger.");
      revalidator.revalidate();
    } catch {
      setStatus("Source verification could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="admin-verification-card admin-surface">
      <div className="admin-verification-card__context">
        <div className="product-chip-row">
          <Badge>Accepted source</Badge>
          <span className="admin-status-badge">@{candidate.authorLabel}</span>
        </div>
        <div className="admin-verification-card__copy">
          <h2>{candidate.postTitle}</h2>
          <p>{candidate.commentBody}</p>
          <small>Accepted {formatDate(candidate.acceptedAt)}</small>
        </div>
        <Link
          className="product-text-action"
          to={postHref(candidate.postId, candidate.postSlug)}
          target="_blank"
          rel="noreferrer"
        >
          Open post
        </Link>
      </div>

      <form className="admin-verification-card__decision" onSubmit={(event) => void verify(event)}>
        <div>
          <span className="product-eyebrow">Integrity decision</span>
          <h3>Verify this accepted source</h3>
          <p>Preserve the canonical source URL and evidence supporting the verification.</p>
        </div>
        <Input
          name="url"
          label="Canonical source URL"
          type="url"
          defaultValue={candidate.canonicalSourceUrl ?? ""}
          required
        />
        <Textarea
          name="evidence"
          label="Evidence note"
          required
          minLength={10}
          maxLength={500}
          rows={4}
        />
        <Button type="submit" loading={busy}>
          Verify accepted source
        </Button>
        {status ? <small role="status">{status}</small> : null}
      </form>
    </Card>
  );
}

function VerifiedSourceCard({ source, canRevoke }: { source: VerifiedSource; canRevoke: boolean }) {
  const revalidator = useRevalidator();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function revoke() {
    if (!canRevoke || reason.trim().length < 3) return;
    setBusy(true);
    setStatus(null);
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
        setStatus(payload?.error?.message ?? "The verification could not be revoked.");
        return;
      }
      setStatus("Verification revoked. The Accepted Source remains part of the post history.");
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
            <Badge>Verified</Badge>
            <span className="admin-status-badge">@{source.authorLabel}</span>
          </div>
          <h2>{source.postTitle}</h2>
        </div>
        <span className="product-search-count">{formatDate(source.verifiedAt)}</span>
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
        {source.verifierLabel ? `Verified by @${source.verifierLabel}` : "Verifier unavailable"}
      </small>
      <div className="admin-card-actions">
        <Link className="product-text-action" to={postHref(source.postId, source.postSlug)}>
          Open post
        </Link>
      </div>
      {canRevoke ? (
        <div className="admin-integrity-revoke">
          <Textarea
            label="Revocation reason"
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
            Revoke verification
          </Button>
          {status ? <small role="status">{status}</small> : null}
        </div>
      ) : null}
    </Card>
  );
}

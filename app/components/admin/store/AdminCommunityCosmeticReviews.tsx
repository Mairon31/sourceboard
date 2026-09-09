import { useCallback, useEffect, useMemo, useState } from "react";
import type { CosmeticVisualDefinition } from "../../../../shared/store/custom-cosmetics";
import { Button, Card } from "../../ui";
import { readCsrfToken } from "../../../data/csrf";
import { cosmeticVisualClass, cosmeticVisualStyle } from "../../product/cosmetic-visual";

type ReviewState = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

type CommunitySubmission = {
  id: string;
  type: string;
  name: string;
  description: string;
  configJson: string;
  lifecycleState: string;
  isEnabled: boolean | number;
  reviewState: ReviewState;
  reviewNote: string | null;
  submittedByUserId: string;
  submittedByUsername: string;
  createdAt: number;
  reviewedAt: number | null;
};

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message ? message : fallback;
}

function visualFromConfig(configJson: string): CosmeticVisualDefinition | undefined {
  try {
    const config = JSON.parse(configJson) as { visual?: CosmeticVisualDefinition };
    return config.visual;
  } catch {
    return undefined;
  }
}

function reviewLabel(state: ReviewState): string {
  if (state === "PENDING_REVIEW") return "Pending review";
  if (state === "APPROVED") return "Approved";
  return "Rejected";
}

export function AdminCommunityCosmeticReviews({
  onStatus,
  onCatalogRefresh,
}: {
  onStatus: (message: string) => void;
  onCatalogRefresh: () => Promise<void>;
}) {
  const [state, setState] = useState<ReviewState>("PENDING_REVIEW");
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decision, setDecision] = useState<{
    submission: CommunitySubmission;
    value: "APPROVE" | "REJECT";
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
        onStatus(errorMessage(payload, "Could not load community cosmetic submissions."));
        return;
      }
      setSubmissions(Array.isArray(payload?.submissions) ? payload.submissions : []);
    } catch {
      onStatus("Could not load community cosmetic submissions. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [onStatus, state]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({ total: submissions.length, current: reviewLabel(state) }),
    [state, submissions.length],
  );

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
        onStatus(errorMessage(payload, "Could not review this cosmetic submission."));
        return;
      }
      onStatus(
        `${decision.submission.name}: ${decision.value === "APPROVE" ? "approved for catalog preparation" : "rejected"}.`,
      );
      setDecision(null);
      setReason("");
      await Promise.all([load(), onCatalogRefresh()]);
    } catch {
      onStatus("Could not review this cosmetic submission. Check your connection.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="admin-store-catalog admin-community-cosmetics">
      <div className="admin-store-section-heading">
        <div>
          <span className="product-eyebrow">Community presets</span>
          <h2>Cosmetic review</h2>
          <p>
            Review restricted visual definitions before they can move from Draft toward public
            publication. Approval never publishes automatically.
          </p>
        </div>
        <span className="product-search-count">
          {counts.total} {counts.current.toLowerCase()}
        </span>
      </div>

      <nav className="admin-store-type-filters" aria-label="Community cosmetic review state">
        {(["PENDING_REVIEW", "APPROVED", "REJECTED"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={state === value ? "is-active" : undefined}
            aria-pressed={state === value}
            onClick={() => setState(value)}
          >
            {reviewLabel(value)}
          </button>
        ))}
      </nav>

      {decision ? (
        <Card className="admin-store-danger-panel">
          <div>
            <strong>
              {decision.value === "APPROVE" ? "Approve" : "Reject"} {decision.submission.name}?
            </strong>
            <p>
              {decision.value === "APPROVE"
                ? "Approval permits a Store manager to publish this Draft later. It does not make the cosmetic public now."
                : "Rejection keeps the item disabled and records the reason in the audit trail."}
            </p>
          </div>
          <label className="sb-field">
            <span>Review reason</span>
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
              variant={decision.value === "REJECT" ? "danger" : "secondary"}
              loading={busyId === decision.submission.id}
              disabled={reason.trim().length < 3}
              onClick={() => void submitDecision()}
            >
              Confirm {decision.value === "APPROVE" ? "approval" : "rejection"}
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
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {loading ? <Card className="product-empty-state">Loading review queue…</Card> : null}

      {!loading && submissions.length ? (
        <div className="admin-store-cosmetic-grid">
          {submissions.map((submission) => {
            const visual = visualFromConfig(submission.configJson);
            return (
              <Card key={submission.id} className="admin-store-cosmetic-card">
                <div
                  className={`admin-store-cosmetic-preview admin-store-community-preview${cosmeticVisualClass(visual)}`}
                  style={cosmeticVisualStyle(visual)}
                >
                  <strong>{submission.name}</strong>
                  <span>{submission.type.replaceAll("_", " ")}</span>
                </div>
                <div className="admin-store-cosmetic-card__body">
                  <div className="admin-store-cosmetic-card__title">
                    <div>
                      <span className="product-eyebrow">{reviewLabel(submission.reviewState)}</span>
                      <h3>{submission.name}</h3>
                    </div>
                    <span className="product-search-count">Draft</span>
                  </div>
                  <p>{submission.description}</p>
                  <div className="admin-store-metric-row">
                    <span>@{submission.submittedByUsername}</span>
                    <span>{new Date(submission.createdAt).toLocaleDateString()}</span>
                  </div>
                  {submission.reviewNote ? (
                    <p className="admin-store-capability-note">Review: {submission.reviewNote}</p>
                  ) : null}
                  {submission.reviewState === "PENDING_REVIEW" ? (
                    <div className="admin-store-card-actions">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setDecision({ submission, value: "APPROVE" });
                          setReason("");
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setDecision({ submission, value: "REJECT" });
                          setReason("");
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : !loading ? (
        <Card className="product-empty-state">No submissions in this review state.</Card>
      ) : null}
    </section>
  );
}

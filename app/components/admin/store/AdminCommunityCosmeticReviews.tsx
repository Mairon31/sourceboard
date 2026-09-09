import { useCallback, useEffect, useMemo, useState } from "react";
import type { CosmeticVisualDefinition } from "../../../../shared/store/custom-cosmetics";
import { Button, Card } from "../../ui";
import { readCsrfToken } from "../../../data/csrf";
import { cosmeticVisualClass, cosmeticVisualStyle } from "../../product/cosmetic-visual";

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
  visual?: CosmeticVisualDefinition;
  communityCss?: string;
  communityCosmeticId?: string;
} {
  try {
    return JSON.parse(configJson) as {
      visual?: CosmeticVisualDefinition;
      communityCss?: string;
      communityCosmeticId?: string;
    };
  } catch {
    return {};
  }
}
function stateLabel(state: CommunityState): string {
  return state
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (value) => value.toUpperCase());
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
        onStatus(errorMessage(payload, "Could not load community cosmetics."));
        return;
      }
      setSubmissions(Array.isArray(payload?.submissions) ? payload.submissions : []);
    } catch {
      onStatus("Could not load community cosmetics. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [onStatus, state]);
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
        onStatus(errorMessage(payload, "Could not moderate this community cosmetic."));
        return;
      }
      onStatus(`${decision.submission.name}: ${decision.value.toLowerCase()} completed.`);
      setDecision(null);
      setReason("");
      await Promise.all([load(), onCatalogRefresh()]);
    } catch {
      onStatus("Could not moderate this community cosmetic. Check your connection.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="admin-store-catalog admin-community-cosmetics">
      <div className="admin-store-section-heading">
        <div>
          <span className="product-eyebrow">Community</span>
          <h2>Cosmetic moderation</h2>
          <p>
            Only explicit approval publishes a community cosmetic. Hide, restore, archive and remove
            remain staff-controlled.
          </p>
        </div>
        <span className="product-search-count">
          {counts} {stateLabel(state).toLowerCase()}
        </span>
      </div>
      <nav className="admin-store-type-filters" aria-label="Community cosmetic state">
        {(["PENDING_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={state === value ? "is-active" : undefined}
            aria-pressed={state === value}
            onClick={() => setState(value)}
          >
            {stateLabel(value)}
          </button>
        ))}
      </nav>
      {decision ? (
        <Card className="admin-store-danger-panel">
          <div>
            <strong>
              {decision.value} {decision.submission.name}?
            </strong>
            <p>
              This action is audited and immediately changes the community catalog state when
              applicable.
            </p>
          </div>
          <label className="sb-field">
            <span>Reason</span>
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
              Confirm {decision.value.toLowerCase()}
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
      {loading ? <Card className="product-empty-state">Loading community catalog…</Card> : null}
      {!loading && submissions.length ? (
        <div className="admin-store-cosmetic-grid">
          {submissions.map((submission) => {
            const config = configFromJson(submission.configJson);
            return (
              <Card key={submission.id} className="admin-store-cosmetic-card">
                <div
                  className={`admin-store-cosmetic-preview admin-store-community-preview cosmetic-root${cosmeticVisualClass(config.visual)}`}
                  style={cosmeticVisualStyle(config.visual)}
                  data-community-cosmetic={config.communityCosmeticId}
                >
                  {config.communityCss ? <style>{config.communityCss}</style> : null}
                  <div className="profile-card">
                    <strong className="profile-name-area">{submission.name}</strong>
                    <span>{submission.type.replaceAll("_", " ")}</span>
                  </div>
                </div>
                <div className="admin-store-cosmetic-card__body">
                  <div className="admin-store-cosmetic-card__title">
                    <div>
                      <span className="product-eyebrow">
                        {stateLabel(submission.communityState)}
                      </span>
                      <h3>{submission.name}</h3>
                    </div>
                    <span className="product-search-count">{submission.moderationState}</span>
                  </div>
                  <p>{submission.description}</p>
                  <div className="admin-store-metric-row">
                    <span>Created by @{submission.submittedByUsername}</span>
                    <span>{submission.pricePoints} pts</span>
                  </div>
                  {submission.reviewNote ? (
                    <p className="admin-store-capability-note">Review: {submission.reviewNote}</p>
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
                        {value}
                      </Button>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : !loading ? (
        <Card className="product-empty-state">No community cosmetics in this state.</Card>
      ) : null}
    </section>
  );
}

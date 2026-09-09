import { useState } from "react";
import { Link, useRevalidator } from "react-router";
import { readCsrfToken } from "../../data/csrf";
import { Badge, Button, Card, Textarea } from "../ui";

export interface SourceDisputeView {
  reportId: string;
  category: string;
  detail: string | null;
  status: string;
  postId: string | null;
  postSlug: string | null;
  postTitle: string | null;
  createdAt: number;
}

function postHref(postId: string, postSlug: string | null): string {
  return postSlug
    ? `/posts/${encodeURIComponent(postId)}/${encodeURIComponent(postSlug)}`
    : `/posts/${encodeURIComponent(postId)}`;
}

function formatDate(value: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function SourceDisputeCard({
  dispute,
  canReview,
}: {
  dispute: SourceDisputeView;
  canReview: boolean;
}) {
  const revalidator = useRevalidator();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"IN_REVIEW" | "DISMISSED" | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function updateStatus(nextStatus: "IN_REVIEW" | "DISMISSED") {
    if (!canReview || busy || reason.trim().length < 3) return;
    setBusy(nextStatus);
    setStatus(null);
    try {
      const response = await fetch(
        `/api/admin/moderation/reports/${encodeURIComponent(dispute.reportId)}/status`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify({ status: nextStatus, reason: reason.trim() }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setStatus(payload?.error?.message ?? "The dispute could not be updated.");
        return;
      }
      setReason("");
      setStatus(nextStatus === "IN_REVIEW" ? "Dispute assigned for review." : "Dispute dismissed.");
      revalidator.revalidate();
    } catch {
      setStatus("The dispute could not be updated.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="admin-integrity-card admin-surface">
      <div className="admin-integrity-card__header">
        <div>
          <div className="product-chip-row">
            <Badge>{dispute.status}</Badge>
            <Badge>{dispute.category}</Badge>
          </div>
          <h2>{dispute.postTitle ?? "Reported source"}</h2>
        </div>
        <span className="product-search-count">{formatDate(dispute.createdAt)}</span>
      </div>
      <p>{dispute.detail || "No additional dispute detail was supplied."}</p>
      <div className="admin-card-actions">
        {dispute.postId ? (
          <Link className="product-text-action" to={postHref(dispute.postId, dispute.postSlug)}>
            Open post
          </Link>
        ) : null}
        <Link className="product-text-action" to="/admin/moderation">
          Full moderation queue
        </Link>
      </div>
      {canReview ? (
        <div className="admin-integrity-revoke">
          <Textarea
            label="Review note"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            minLength={3}
            maxLength={1000}
            placeholder="Document why this dispute is being reviewed or dismissed."
          />
          <div className="product-chip-row">
            <Button
              variant="secondary"
              disabled={reason.trim().length < 3 || dispute.status === "IN_REVIEW" || Boolean(busy)}
              loading={busy === "IN_REVIEW"}
              onClick={() => void updateStatus("IN_REVIEW")}
            >
              {dispute.status === "IN_REVIEW" ? "Under review" : "Start review"}
            </Button>
            <Button
              variant="ghost"
              disabled={reason.trim().length < 3 || Boolean(busy)}
              loading={busy === "DISMISSED"}
              onClick={() => void updateStatus("DISMISSED")}
            >
              Dismiss dispute
            </Button>
          </div>
          {status ? <small role="status">{status}</small> : null}
        </div>
      ) : null}
    </Card>
  );
}

import { useState } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { Badge, Button, Card, Input, Textarea } from "../components/ui";
import { loadCapabilityAccess } from "../data/capability-access";
import { readCsrfToken } from "../data/csrf";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

interface Candidate {
  postId: string;
  postSlug: string | null;
  postTitle: string;
  commentId: string;
  commentBody: string;
  authorLabel: string;
}

export async function loader({ request, context }: ServerLoaderArgs) {
  return withOptionalServerSession(
    request,
    context,
    () => ({ access: { authorized: false, unavailable: false }, candidates: [] as Candidate[] }),
    async (runtime, userId) => {
      const access = await loadCapabilityAccess(request, context, "source.verify");
      if (!userId || !access.authorized) return { access, candidates: [] as Candidate[] };
      const result = await runtime.db
        .prepare(
          `SELECT p.id AS postId, p.slug AS postSlug, p.title AS postTitle,
                  c.id AS commentId, c.body_plaintext AS commentBody, u.username AS authorLabel
           FROM comments c
           JOIN posts p ON p.id = c.post_id
           JOIN users u ON u.id = c.author_id
           WHERE c.state = 'VISIBLE' AND c.deleted_at IS NULL
             AND p.deleted_at IS NULL AND p.hidden_at IS NULL AND p.verified_source_id IS NULL
           ORDER BY c.created_at ASC
           LIMIT 100`,
        )
        .all<Candidate>();
      return { access, candidates: result.results };
    },
  );
}

export default function AdminVerificationsRoute() {
  const { access, candidates } = useLoaderData<typeof loader>();
  if (!access.authorized) {
    return (
      <AdminShell>
        <AdminPageHeader
          eyebrow="Restricted"
          title="Source verification"
          description="The source.verify capability is required."
        />
        <Card className="product-empty-state">
          Sign in with an authorized verifier account to continue.
        </Card>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="Source verification"
        title="Verification queue"
        description="Review the accepted answer in context, preserve evidence and issue a reversible verification decision."
      />
      <section className="admin-section">
        {candidates.length ? (
          candidates.map((candidate) => (
            <VerificationCandidate key={candidate.commentId} candidate={candidate} />
          ))
        ) : (
          <Card className="product-empty-state admin-surface">
            No pending source candidates are available.
          </Card>
        )}
      </section>
    </AdminShell>
  );
}

function VerificationCandidate({ candidate }: { candidate: Candidate }) {
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const postHref = candidate.postSlug
    ? `/posts/${encodeURIComponent(candidate.postId)}/${encodeURIComponent(candidate.postSlug)}`
    : `/posts/${encodeURIComponent(candidate.postId)}`;

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
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
      setStatus("Source verified.");
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
          <Badge>Pending review</Badge>
          <span className="admin-status-badge">@{candidate.authorLabel}</span>
        </div>
        <div className="admin-verification-card__copy">
          <h2>{candidate.postTitle}</h2>
          <p>{candidate.commentBody}</p>
          <small>Comment {candidate.commentId}</small>
        </div>
        <Link className="product-text-action" to={postHref} target="_blank" rel="noreferrer">
          Open post
        </Link>
      </div>

      <form className="admin-verification-card__decision" onSubmit={(event) => void verify(event)}>
        <div>
          <span className="product-eyebrow">Decision</span>
          <h3>Verify accepted source</h3>
          <p>Record the canonical URL and the evidence that supports this verification.</p>
        </div>
        <Input name="url" label="Canonical source URL" type="url" required />
        <Textarea
          name="evidence"
          label="Evidence note"
          required
          minLength={10}
          maxLength={500}
          rows={4}
        />
        <Button type="submit" loading={busy}>
          Verify source
        </Button>
        {status ? <small role="status">{status}</small> : null}
      </form>
    </Card>
  );
}

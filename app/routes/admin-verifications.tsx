import { useLoaderData } from "react-router";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { Badge, Button, Card, Input, Textarea } from "../components/ui";
import { loadCapabilityAccess } from "../data/capability-access";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

interface Candidate {
  postId: string;
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
          `SELECT p.id AS postId, p.title AS postTitle, c.id AS commentId, c.body_plaintext AS commentBody, u.username AS authorLabel FROM comments c JOIN posts p ON p.id = c.post_id JOIN users u ON u.id = c.author_id WHERE c.state = 'VISIBLE' AND c.deleted_at IS NULL AND p.deleted_at IS NULL AND p.hidden_at IS NULL AND p.verified_source_id IS NULL ORDER BY c.created_at ASC LIMIT 100`,
        )
        .all<Candidate>();
      return { access, candidates: result.results };
    },
  );
}
function csrf(): string {
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("__Host-sourceboard_csrf="));
  return value ? decodeURIComponent(value.slice("__Host-sourceboard_csrf=".length)) : "";
}
export default function AdminVerificationsRoute() {
  const { access, candidates } = useLoaderData<typeof loader>();
  if (!access.authorized)
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
  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="Source verification"
        title="Verification queue"
        description="Review a public source, preserve evidence and issue a reversible verification decision."
      />
      {candidates.length ? (
        candidates.map((candidate) => (
          <VerificationCandidate key={candidate.commentId} candidate={candidate} />
        ))
      ) : (
        <Card className="product-empty-state">No pending source candidates are available.</Card>
      )}
    </AdminShell>
  );
}
function VerificationCandidate({ candidate }: { candidate: Candidate }) {
  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(
      `/api/posts/${encodeURIComponent(candidate.postId)}/source/verify`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrf() },
        body: JSON.stringify({
          commentId: candidate.commentId,
          canonicalSourceUrl: form.get("url"),
          evidenceNote: form.get("evidence"),
        }),
      },
    );
    if (response.ok) window.location.reload();
  }
  return (
    <Card className="product-form-card">
      <div className="product-section-heading">
        <div>
          <Badge>Pending review</Badge>
          <h2>{candidate.postTitle}</h2>
          <p>
            {candidate.authorLabel}: {candidate.commentBody}
          </p>
        </div>
      </div>
      <form className="product-form-grid" onSubmit={(event) => void verify(event)}>
        <Input name="url" label="Canonical source URL" type="url" required />
        <Textarea name="evidence" label="Evidence note" required minLength={10} maxLength={500} />
        <Button type="submit">Verify source</Button>
      </form>
    </Card>
  );
}

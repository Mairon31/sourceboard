import type { ServerLoaderArgs } from "../data/server-request";
import { loadCapabilityAccess } from "../data/capability-access";
import { requireAdminPageAccess } from "../data/admin-access";
import { withOptionalServerSession } from "../data/server-request";
import AdminVerificationsRoute from "./admin-verifications";

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

export async function loader({ request, context }: ServerLoaderArgs) {
  await requireAdminPageAccess(request, context);
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

export default AdminVerificationsRoute;


import { Link, useLoaderData } from "react-router";
import { createAdminReadService } from "../../worker/admin/read";
import { AdminMetric } from "../components/admin/AdminMetric";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { Card } from "../components/ui";
import { requireAdminPageAccess } from "../data/admin-access";
import type { ServerLoaderArgs } from "../data/server-request";

export async function loader({ request, context }: ServerLoaderArgs) {
  const { runtime } = await requireAdminPageAccess(request, context);

  try {
    return {
      authorized: true,
      unavailable: false,
      overview: await createAdminReadService(runtime.db).overview(),
    };
  } catch {
    return { authorized: true, unavailable: true, overview: null };
  }
}

function formatAdminDate(value: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default function AdminRoute() {
  const access = useLoaderData<typeof loader>();

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="Control center"
        title="Administration"
        description="Moderation, source verification, catalog health and privileged activity from the SourceBoard production data model."
        actions={<Link to="/admin/moderation">Review queue</Link>}
      />

      {access.unavailable || !access.overview ? (
        <Card className="product-empty-state admin-surface">
          Operational metrics are temporarily unavailable. Administrative writes remain protected by
          their server-side capabilities.
        </Card>
      ) : (
        <>
          <div className="admin-metric-grid" aria-label="Administration overview metrics">
            <AdminMetric
              label="Open reports"
              value={access.overview.openReports}
              hint="Open or in review"
              href="/admin/moderation"
            />
            <AdminMetric
              label="Pending verification"
              value={access.overview.pendingVerificationCandidates}
              hint="Visible source candidates"
              href="/admin/verifications"
            />
            <AdminMetric
              label="Published store items"
              value={access.overview.publishedStoreItems}
              hint="Currently available"
              href="/admin/store"
            />
            <AdminMetric
              label="Draft store items"
              value={access.overview.draftStoreItems}
              hint="Not currently published"
              href="/admin/store"
            />
            <AdminMetric
              label="Flagged catalog"
              value={access.overview.flaggedCatalogItems}
              hint="Inactive emotes or stickers"
              href="/admin/store"
            />
          </div>

          <section className="admin-section">
            <div className="admin-section-header">
              <div>
                <h2>Recent audit</h2>
                <p>Latest privileged operations persisted by SourceBoard.</p>
              </div>
              <Link to="/admin/audit">View audit log</Link>
            </div>

            {access.overview.recentAudit.length ? (
              <>
                <div className="admin-table admin-desktop-table" role="table">
                  <div className="admin-table__row admin-table__row--header" role="row">
                    <span>Action</span>
                    <span>Actor</span>
                    <span>Target</span>
                    <span>When</span>
                    <span />
                  </div>
                  {access.overview.recentAudit.map((entry) => (
                    <div className="admin-table__row" role="row" key={entry.id}>
                      <div className="admin-table__copy">
                        <strong>{entry.action}</strong>
                        <span>{entry.reason ?? "No reason recorded"}</span>
                      </div>
                      <span>{entry.actorUsername ? `@${entry.actorUsername}` : "System"}</span>
                      <span>
                        {entry.targetType}
                        {entry.targetId ? ` · ${entry.targetId}` : ""}
                      </span>
                      <span>{formatAdminDate(entry.createdAt)}</span>
                      <span />
                    </div>
                  ))}
                </div>

                <div className="admin-mobile-card-list">
                  {access.overview.recentAudit.map((entry) => (
                    <Card className="admin-mobile-review-card admin-surface" key={entry.id}>
                      <div className="admin-mobile-review-card__row">
                        <strong>{entry.action}</strong>
                        <span className="admin-status-badge">
                          {formatAdminDate(entry.createdAt)}
                        </span>
                      </div>
                      <span>{entry.actorUsername ? `@${entry.actorUsername}` : "System"}</span>
                      <small>
                        {entry.targetType}
                        {entry.targetId ? ` · ${entry.targetId}` : ""}
                      </small>
                      {entry.reason ? <small>{entry.reason}</small> : null}
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <Card className="product-empty-state admin-surface">No audit activity yet.</Card>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}

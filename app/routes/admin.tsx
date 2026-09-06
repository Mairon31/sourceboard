import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { Card } from "../components/ui";
import { loadAdminAccess } from "../data/admin-access";
import { useLoaderData } from "react-router";
import type { ServerLoaderArgs } from "../data/server-request";

export async function loader({ request, context }: ServerLoaderArgs) {
  return loadAdminAccess(request, context);
}

function AccessDenied() {
  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="Restricted"
        title="Admin access required"
        description="This operational surface is protected by the admin.access capability."
      />
      <Card className="product-empty-state">
        Sign in with an authorized administrative account to continue.
      </Card>
    </AdminShell>
  );
}

export default function AdminRoute() {
  const access = useLoaderData<typeof loader>();
  if (!access.authorized) return <AccessDenied />;
  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="Control center"
        title="Administration"
        description="A denser operational surface for moderation, roles, source verification, cosmetics and audit work."
        actions={<a href="/admin/moderation">Review queue</a>}
      />

      <Card className="product-form-card">
        Administrative reads and writes are capability-checked server-side. Operational counts,
        moderation queues and catalog entries are loaded from D1; no fixture metrics are shown here.
      </Card>

      <section className="admin-section" id="source-verification">
        <div className="admin-section-header">
          <div>
            <h2>Source verification</h2>
            <p>Review accepted answers before issuing a verified-source seal.</p>
          </div>
          <a href="/admin/moderation">Open moderation</a>
        </div>
        <Card className="product-empty-state">
          Source verification workflows are capability-defined and will appear here when their
          persisted review queue is available.
        </Card>
      </section>

      <section className="admin-section" id="audit">
        <div className="admin-section-header">
          <div>
            <h2>Audit</h2>
            <p>Production deanonymization and moderation actions will be immutable/audited.</p>
          </div>
        </div>
        <Card className="product-form-card">
          Audit records are persisted for privileged identity and moderation operations. Dedicated
          filters are intentionally not represented by fixture data.
        </Card>
      </section>
    </AdminShell>
  );
}

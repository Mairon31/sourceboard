import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { Badge, Button, Card } from "../components/ui";
import { PresentationNotice } from "../components/product/ProductShell";

export default function AdminRoute() {
  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="Control center"
        title="Administration"
        description="A denser operational surface for moderation, roles, source verification, cosmetics and audit work."
        actions={<Button size="sm">Review queue</Button>}
      />

      <div className="admin-metric-grid">
        <Card className="admin-metric"><Badge tone="warning">Needs attention</Badge><strong>2</strong><span>Open reports</span></Card>
        <Card className="admin-metric"><Badge tone="success">Source review</Badge><strong>1</strong><span>Verified fixture today</span></Card>
        <Card className="admin-metric"><Badge>Audit</Badge><strong>0</strong><span>Persistent writes in Phase 0B</span></Card>
      </div>

      <PresentationNotice>
        Admin metrics and actions are fixture-backed presentation states. No privileged write path exists in this phase.
      </PresentationNotice>

      <section className="admin-section" id="source-verification">
        <div className="admin-section-header">
          <div><h2>Source verification</h2><p>Review accepted answers before issuing a verified-source seal.</p></div>
          <a href="/admin/moderation">Open moderation</a>
        </div>
        <div className="admin-table">
          <div className="admin-table__row admin-table__row--header"><span>Item</span><span>Status</span><span>Reports</span><span>Age</span><span>Action</span></div>
          <div className="admin-table__row"><div className="admin-table__copy"><strong>Original editorial photo found and verified</strong><span>post-verified</span></div><Badge tone="success">Verified</Badge><span>1</span><span>2 h</span><Button size="sm" variant="secondary">Inspect</Button></div>
        </div>
      </section>

      <section className="admin-section" id="audit">
        <div className="admin-section-header"><div><h2>Audit</h2><p>Production deanonymization and moderation actions will be immutable/audited.</p></div></div>
        <Card className="product-form-card">No persistent audit records exist in Phase 0B.</Card>
      </section>
    </AdminShell>
  );
}

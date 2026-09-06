import { Link, useLoaderData } from "react-router";
import { fixtureUiDataAdapter } from "../data/ui-adapter";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { Badge, Button } from "../components/ui";
import { PresentationNotice } from "../components/product/ProductShell";

export async function loader() {
  return { queue: await fixtureUiDataAdapter.getModerationQueue() };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function AdminModerationRoute() {
  const { queue } = useLoaderData<LoaderData>();

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="Trust & safety"
        title="Moderation queue"
        description="Review reports with enough context to make a decision without exposing privileged data unnecessarily."
      />
      <PresentationNotice>
        Moderation buttons are visual states only; no sanctions or post mutations are performed.
      </PresentationNotice>

      <section className="admin-section">
        <div className="admin-table">
          <div className="admin-table__row admin-table__row--header">
            <span>Report</span>
            <span>Source</span>
            <span>Reports</span>
            <span>Age</span>
            <span>Action</span>
          </div>
          {queue.map((item) => (
            <div key={item.id} className="admin-table__row">
              <div className="admin-table__copy">
                <strong>{item.postTitle}</strong>
                <span>{item.reason}</span>
                <div className="product-chip-row">
                  {item.isNsfw ? <Badge tone="nsfw">NSFW</Badge> : null}
                  {item.authorMode === "ANONYMOUS" ? <Badge>Anonymous</Badge> : null}
                </div>
              </div>
              <Badge tone={item.sourceStatus === "VERIFIED" ? "success" : "neutral"}>
                {item.sourceStatus.toLowerCase()}
              </Badge>
              <span>{item.reportCount}</span>
              <span>{item.ageLabel}</span>
              <div className="product-chip-row">
                {item.authorMode === "ANONYMOUS" ? (
                  <Link to={`/admin/anonymous/${item.postId}`} className="product-text-action">
                    Identity
                  </Link>
                ) : null}
                <Button size="sm" variant="secondary">
                  Review
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}

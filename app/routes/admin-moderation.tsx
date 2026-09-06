import { useLoaderData } from "react-router";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { PresentationNotice } from "../components/product/ProductShell";
import { loadAdminAccess } from "../data/admin-access";
import type { ServerLoaderArgs } from "../data/server-request";

export async function loader({ request, context }: ServerLoaderArgs) {
  const access = await loadAdminAccess(request, context);
  return { access, queue: [] };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function AdminModerationRoute() {
  const { access } = useLoaderData<LoaderData>();
  if (!access.authorized) {
    return (
      <AdminShell>
        <AdminPageHeader
          eyebrow="Restricted"
          title="Admin access required"
          description="This operational surface is protected by the admin.access capability."
        />
      </AdminShell>
    );
  }

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
        <p className="product-empty-state">No persisted moderation queue is available yet.</p>
      </section>
    </AdminShell>
  );
}

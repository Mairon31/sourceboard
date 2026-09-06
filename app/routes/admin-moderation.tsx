import { useLoaderData } from "react-router";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { loadAdminAccess } from "../data/admin-access";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";
import { createModerationService } from "../../worker/moderation/service";

export async function loader({ request, context }: ServerLoaderArgs) {
  return withOptionalServerSession(
    request,
    context,
    (unavailable) => ({ access: { authorized: false, unavailable }, queue: [] }),
    async (runtime) => {
      const access = await loadAdminAccess(request, context);
      return {
        access,
        queue: access.authorized ? await createModerationService(runtime.db).listQueue() : [],
      };
    },
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function AdminModerationRoute() {
  const { access, queue } = useLoaderData<LoaderData>();
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
      <section className="admin-section">
        {queue.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <caption className="sr-only">Open moderation reports</caption>
              <thead>
                <tr>
                  <th scope="col">Target</th>
                  <th scope="col">Category</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reported</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((report) => (
                  <tr key={String(report.id)}>
                    <td>
                      <strong>{String(report.targetType)}</strong>
                      <small>{String(report.targetId)}</small>
                    </td>
                    <td>{String(report.category)}</td>
                    <td>{String(report.status)}</td>
                    <td>{new Date(Number(report.createdAt)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="product-empty-state">No open moderation reports.</p>
        )}
      </section>
    </AdminShell>
  );
}

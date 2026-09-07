import { useLoaderData } from "react-router";
import { createAdminReadService } from "../../worker/admin/read";
import type { AdminRoleRow } from "../../worker/admin/types";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { Badge, Card } from "../components/ui";
import { loadAdminAccess } from "../data/admin-access";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

export async function loader({ request, context }: ServerLoaderArgs) {
  return withOptionalServerSession(
    request,
    context,
    (unavailable) => ({
      access: { authorized: false, unavailable },
      roles: [] as AdminRoleRow[],
    }),
    async (runtime) => {
      const access = await loadAdminAccess(request, context);
      return {
        access,
        roles: access.authorized ? await createAdminReadService(runtime.db).roles() : [],
      };
    },
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

function CapabilityBadges({ capabilities }: { capabilities: string[] }) {
  if (!capabilities.length) {
    return <span className="product-search-count">No capabilities</span>;
  }

  return (
    <div className="product-chip-row">
      {capabilities.map((capability) => (
        <Badge key={capability}>{capability}</Badge>
      ))}
    </div>
  );
}

export default function AdminRolesRoute() {
  const { access, roles } = useLoaderData<LoaderData>();

  if (!access.authorized) {
    return (
      <AdminShell>
        <AdminPageHeader
          eyebrow="Restricted"
          title="Roles"
          description="This operational surface is protected by the admin.access capability."
        />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="Identity & access"
        title="Roles"
        description="Review role hierarchy, system status, assignments and effective capabilities."
      />

      <section className="admin-section">
        {roles.length ? (
          <>
            <div className="admin-table admin-desktop-table" role="table">
              <div className="admin-table__row admin-table__row--header" role="row">
                <span>Role</span>
                <span>Rank</span>
                <span>System</span>
                <span>Assignments</span>
                <span>Capabilities</span>
              </div>
              {roles.map((role) => (
                <div className="admin-table__row" role="row" key={role.id}>
                  <div className="admin-table__copy">
                    <strong>{role.name}</strong>
                    <span>{role.slug}</span>
                  </div>
                  <span>{role.rank}</span>
                  <span className="admin-status-badge">{role.isSystem ? "System" : "Custom"}</span>
                  <span>{role.assignmentCount}</span>
                  <CapabilityBadges capabilities={role.capabilities} />
                </div>
              ))}
            </div>

            <div className="admin-mobile-card-list">
              {roles.map((role) => (
                <Card className="admin-mobile-review-card admin-surface" key={role.id}>
                  <div className="admin-mobile-review-card__row">
                    <div className="admin-table__copy">
                      <strong>{role.name}</strong>
                      <span>{role.slug}</span>
                    </div>
                    <span className="admin-status-badge">{role.isSystem ? "System" : "Custom"}</span>
                  </div>
                  <small>Rank {role.rank}</small>
                  <small>{role.assignmentCount} assignments</small>
                  <CapabilityBadges capabilities={role.capabilities} />
                </Card>
              ))}
            </div>
          </>
        ) : (
          <Card className="product-empty-state admin-surface">No roles are configured.</Card>
        )}
      </section>
    </AdminShell>
  );
}

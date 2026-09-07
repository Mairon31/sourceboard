import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { createAdminReadService } from "../../worker/admin/read";
import type { AdminRoleRow, AdminUserRow } from "../../worker/admin/types";
import { AdminActionMenu } from "../components/admin/AdminActionMenu";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { Badge, Button, Card, Input, Modal, OverlayActionRow, Textarea } from "../components/ui";
import { loadAdminAccess } from "../data/admin-access";
import { loadCapabilityAccess } from "../data/capability-access";
import { readCsrfToken } from "../data/csrf";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

const ROLE_SLUGS = ["owner", "admin", "moderator", "source_verifier", "user"] as const;
type RoleSlug = (typeof ROLE_SLUGS)[number];
type RoleOperation = "assign" | "remove";

function isRoleSlug(value: string): value is RoleSlug {
  return (ROLE_SLUGS as readonly string[]).includes(value);
}

export async function loader({ request, context }: ServerLoaderArgs) {
  const requestUrl = new URL(request.url);
  const query = requestUrl.searchParams.get("q")?.trim() ?? "";
  return withOptionalServerSession(
    request,
    context,
    (unavailable) => ({
      access: { authorized: false, unavailable },
      canAssignRoles: false,
      query,
      users: [] as AdminUserRow[],
      roles: [] as AdminRoleRow[],
    }),
    async (runtime) => {
      const access = await loadAdminAccess(request, context);
      if (!access.authorized) {
        return {
          access,
          canAssignRoles: false,
          query,
          users: [] as AdminUserRow[],
          roles: [] as AdminRoleRow[],
        };
      }
      const roleAccess = await loadCapabilityAccess(request, context, "user.assign_roles");
      const read = createAdminReadService(runtime.db);
      const [users, roles] = await Promise.all([
        read.users(query),
        roleAccess.authorized ? read.roles() : Promise.resolve([] as AdminRoleRow[]),
      ]);
      return {
        access,
        canAssignRoles: roleAccess.authorized,
        query,
        users,
        roles: roles.filter((role) => isRoleSlug(role.slug)),
      };
    },
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

function formatDate(value: number | null): string {
  if (value === null) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function RoleBadges({ roles }: { roles: string[] }) {
  if (!roles.length) return <span className="product-search-count">No role</span>;
  return (
    <div className="product-chip-row">
      {roles.map((role) => (
        <Badge key={role}>{role}</Badge>
      ))}
    </div>
  );
}

export default function AdminUsersRoute() {
  const { access, canAssignRoles, query, users, roles } = useLoaderData<LoaderData>();
  const revalidator = useRevalidator();
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [role, setRole] = useState<RoleSlug>("user");
  const [operation, setOperation] = useState<RoleOperation>("assign");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  if (!access.authorized) {
    return (
      <AdminShell>
        <AdminPageHeader
          eyebrow="Restricted"
          title="Users"
          description="This operational surface is protected by the admin.access capability."
        />
      </AdminShell>
    );
  }

  function openRoleDialog(user: AdminUserRow) {
    const existing = user.roles.find(isRoleSlug);
    setSelectedUser(user);
    setRole(existing ?? "user");
    setOperation("assign");
    setReason("");
    setDialogError(null);
    setStatus(null);
  }

  async function changeRole() {
    if (!selectedUser || !canAssignRoles || busy) return;
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 3) {
      setDialogError("Enter a reason of at least 3 characters.");
      return;
    }
    setBusy(true);
    setDialogError(null);
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(selectedUser.id)}/roles`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": readCsrfToken(),
          },
          body: JSON.stringify({ role, operation, reason: normalizedReason }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setDialogError(payload?.error?.message ?? "The role change could not be saved.");
        return;
      }
      setStatus(`${operation === "assign" ? "Assigned" : "Removed"} ${role} for @${selectedUser.username}.`);
      setSelectedUser(null);
      revalidator.revalidate();
    } catch {
      setDialogError("The role change could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  function actionsFor(user: AdminUserRow) {
    if (!canAssignRoles) return null;
    return (
      <AdminActionMenu
        label="Actions"
        items={[{ label: "Manage roles", onSelect: () => openRoleDialog(user) }]}
      />
    );
  }

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="Identity & access"
        title="Users"
        description="Search public account identity, review status and roles, and apply capability-checked role changes."
      />

      <section className="admin-section">
        <form className="admin-filter-bar" method="get">
          <Input
            name="q"
            label="Search users"
            defaultValue={query}
            placeholder="Username or display name"
          />
          <Button type="submit">Search</Button>
          {query ? (
            <a className="sb-button sb-button--ghost sb-button--md" href="/admin/users">
              Clear
            </a>
          ) : null}
          <span className="product-search-count">{users.length} users</span>
        </form>

        {status ? (
          <div className="product-presentation-notice" role="status">
            {status}
          </div>
        ) : null}

        {users.length ? (
          <>
            <div className="admin-table admin-desktop-table" role="table">
              <div className="admin-table__row admin-table__row--header" role="row">
                <span>User</span>
                <span>Roles</span>
                <span>Status</span>
                <span>Activity</span>
                <span>Actions</span>
              </div>
              {users.map((user) => (
                <div className="admin-table__row" role="row" key={user.id}>
                  <div className="admin-table__copy">
                    <strong>{user.displayName}</strong>
                    <span>@{user.username}</span>
                    <span>Joined {formatDate(user.createdAt)}</span>
                  </div>
                  <RoleBadges roles={user.roles} />
                  <span className="admin-status-badge">{user.status}</span>
                  <span>{formatDate(user.lastSeenAt)}</span>
                  <div className="admin-action-cell">{actionsFor(user)}</div>
                </div>
              ))}
            </div>

            <div className="admin-mobile-card-list">
              {users.map((user) => (
                <Card className="admin-mobile-review-card admin-surface" key={user.id}>
                  <div className="admin-mobile-review-card__row">
                    <div className="admin-table__copy">
                      <strong>{user.displayName}</strong>
                      <span>@{user.username}</span>
                    </div>
                    <span className="admin-status-badge">{user.status}</span>
                  </div>
                  <RoleBadges roles={user.roles} />
                  <small>Joined {formatDate(user.createdAt)}</small>
                  <small>Last active {formatDate(user.lastSeenAt)}</small>
                  <div className="admin-action-cell">{actionsFor(user)}</div>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <Card className="product-empty-state admin-surface">No users match this search.</Card>
        )}
      </section>

      {selectedUser ? (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open && !busy) setSelectedUser(null);
          }}
          title={`Manage roles for @${selectedUser.username}`}
          description="Role changes are checked against your capabilities and role hierarchy on the server."
        >
          <div className="product-form-card">
            <label className="sb-field">
              <span className="sb-field__label">Operation</span>
              <select
                className="sb-input"
                value={operation}
                onChange={(event) => setOperation(event.target.value as RoleOperation)}
              >
                <option value="assign">Assign</option>
                <option value="remove">Remove</option>
              </select>
            </label>
            <label className="sb-field">
              <span className="sb-field__label">Role</span>
              <select
                className="sb-input"
                value={role}
                onChange={(event) => setRole(event.target.value as RoleSlug)}
              >
                {roles.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name} · rank {item.rank}
                  </option>
                ))}
              </select>
            </label>
            <Textarea
              label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={dialogError ?? undefined}
              placeholder="Explain why this role change is necessary."
              rows={4}
              maxLength={2000}
            />
            <OverlayActionRow>
              <Button variant="ghost" disabled={busy} onClick={() => setSelectedUser(null)}>
                Cancel
              </Button>
              <Button loading={busy} onClick={() => void changeRole()}>
                Save role change
              </Button>
            </OverlayActionRow>
          </div>
        </Modal>
      ) : null}
    </AdminShell>
  );
}

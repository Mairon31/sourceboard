import { useLoaderData } from "react-router";
import { createAdminReadService } from "../../worker/admin/read";
import type { AdminAuditFilters, AdminAuditRow } from "../../worker/admin/types";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { Button, Card, Input } from "../components/ui";
import { loadCapabilityAccess } from "../data/capability-access";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

interface AuditQuery {
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  from: string;
  to: string;
}

function readQuery(request: Request): AuditQuery {
  const searchParams = new URL(request.url).searchParams;
  return {
    actor: searchParams.get("actor")?.trim() ?? "",
    action: searchParams.get("action")?.trim() ?? "",
    targetType: searchParams.get("targetType")?.trim() ?? "",
    targetId: searchParams.get("targetId")?.trim() ?? "",
    from: searchParams.get("from")?.trim() ?? "",
    to: searchParams.get("to")?.trim() ?? "",
  };
}

function parseDateBoundary(value: string, endOfDay = false): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const timestamp = Date.parse(`${value}${suffix}`);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function toAuditFilters(query: AuditQuery): AdminAuditFilters {
  return {
    actor: query.actor || undefined,
    action: query.action || undefined,
    targetType: query.targetType || undefined,
    targetId: query.targetId || undefined,
    from: parseDateBoundary(query.from),
    to: parseDateBoundary(query.to, true),
    limit: 100,
  };
}

export async function loader({ request, context }: ServerLoaderArgs) {
  const query = readQuery(request);
  return withOptionalServerSession(
    request,
    context,
    (unavailable) => ({
      access: { authorized: false, unavailable },
      query,
      rows: [] as AdminAuditRow[],
    }),
    async (runtime) => {
      const access = await loadCapabilityAccess(request, context, "audit.read");
      return {
        access,
        query,
        rows: access.authorized
          ? await createAdminReadService(runtime.db).audit(toAuditFilters(query))
          : ([] as AdminAuditRow[]),
      };
    },
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

function formatDate(value: number): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatMetadata(metadataJson: string | null): string | null {
  if (!metadataJson) return null;
  try {
    const parsed: unknown = JSON.parse(metadataJson);
    return typeof parsed === "string" ? parsed : (JSON.stringify(parsed) ?? metadataJson);
  } catch {
    return metadataJson;
  }
}

function actorLabel(row: AdminAuditRow): string {
  if (row.actorUsername) return `@${row.actorUsername}`;
  return row.actorUserId ?? "System";
}

function targetLabel(row: AdminAuditRow): string {
  return row.targetId ? `${row.targetType} · ${row.targetId}` : row.targetType;
}

function AuditDetails({ row }: { row: AdminAuditRow }) {
  const metadata = formatMetadata(row.metadataJson);
  return (
    <div className="admin-table__copy">
      <strong>{row.reason ?? "No reason recorded"}</strong>
      {metadata ? <span title={metadata}>{metadata}</span> : <span>No metadata</span>}
    </div>
  );
}

export default function AdminAuditRoute() {
  const { access, query, rows } = useLoaderData<LoaderData>();

  if (!access.authorized) {
    return (
      <AdminShell>
        <AdminPageHeader
          eyebrow="Restricted"
          title="Audit"
          description="This operational surface requires the audit.read capability."
        />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="Accountability"
        title="Audit"
        description="Review privileged activity using persisted audit records and fixed operational filters."
      />

      <section className="admin-section">
        <form className="admin-filter-bar" method="get">
          <Input
            name="actor"
            label="Actor"
            defaultValue={query.actor}
            placeholder="Username or user ID"
          />
          <Input name="action" label="Action" defaultValue={query.action} placeholder="Action" />
          <Input
            name="targetType"
            label="Target type"
            defaultValue={query.targetType}
            placeholder="post, user, catalog…"
          />
          <Input
            name="targetId"
            label="Target ID"
            defaultValue={query.targetId}
            placeholder="Target ID"
          />
          <label className="sb-field">
            <span className="sb-field__label">From (UTC)</span>
            <input className="sb-input" type="date" name="from" defaultValue={query.from} />
          </label>
          <label className="sb-field">
            <span className="sb-field__label">To (UTC)</span>
            <input className="sb-input" type="date" name="to" defaultValue={query.to} />
          </label>
          <Button type="submit">Filter</Button>
          {Object.values(query).some(Boolean) ? (
            <a className="sb-button sb-button--ghost sb-button--md" href="/admin/audit">
              Clear
            </a>
          ) : null}
          <span className="product-search-count">{rows.length} entries</span>
        </form>

        {rows.length ? (
          <>
            <div className="admin-table admin-desktop-table" role="table">
              <div className="admin-table__row admin-table__row--header" role="row">
                <span>Actor</span>
                <span>Action</span>
                <span>Target</span>
                <span>Reason & metadata</span>
                <span>Timestamp</span>
              </div>
              {rows.map((row) => (
                <div className="admin-table__row" role="row" key={row.id}>
                  <span>{actorLabel(row)}</span>
                  <span>{row.action}</span>
                  <span>{targetLabel(row)}</span>
                  <AuditDetails row={row} />
                  <span>{formatDate(row.createdAt)}</span>
                </div>
              ))}
            </div>

            <div className="admin-mobile-card-list">
              {rows.map((row) => (
                <Card className="admin-mobile-review-card admin-surface" key={row.id}>
                  <div className="admin-mobile-review-card__row">
                    <div className="admin-table__copy">
                      <strong>{row.action}</strong>
                      <span>{actorLabel(row)}</span>
                    </div>
                    <span className="admin-status-badge">{row.targetType}</span>
                  </div>
                  <small>{targetLabel(row)}</small>
                  <AuditDetails row={row} />
                  <small>{formatDate(row.createdAt)}</small>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <Card className="product-empty-state admin-surface">
            No audit entries match these filters.
          </Card>
        )}
      </section>
    </AdminShell>
  );
}

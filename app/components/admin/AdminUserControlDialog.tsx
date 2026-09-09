import { useEffect, useMemo, useState } from "react";
import type { AdminUserRow } from "../../../worker/admin/types";
import type { AdminUserSanction } from "../../../worker/admin/user-control";
import { readCsrfToken } from "../../data/csrf";
import { CosmeticIdentity } from "../product/CosmeticIdentity";
import { Badge, Button, Modal, OverlayActionRow, Textarea } from "../ui";

type UserControlAction =
  | "POSTING_RESTRICTION"
  | "COMMENT_RESTRICTION"
  | "SUSPEND"
  | "BAN"
  | "REVOKE_SESSIONS"
  | "NOTE"
  | "ANONYMIZE";

export interface AdminUserControlCapabilities {
  suspend: boolean;
  ban: boolean;
  delete: boolean;
}

function formatDate(value: number | null): string {
  if (value === null) return "No expiry";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function actionOptions(capabilities: AdminUserControlCapabilities) {
  const options: Array<{ value: UserControlAction; label: string; destructive?: boolean }> = [];
  if (capabilities.suspend) {
    options.push(
      { value: "POSTING_RESTRICTION", label: "Restrict posting" },
      { value: "COMMENT_RESTRICTION", label: "Restrict commenting" },
      { value: "SUSPEND", label: "Suspend account" },
      { value: "REVOKE_SESSIONS", label: "Sign out all sessions" },
      { value: "NOTE", label: "Add moderation note" },
    );
  }
  if (capabilities.ban) options.push({ value: "BAN", label: "Ban account", destructive: true });
  if (capabilities.delete)
    options.push({ value: "ANONYMIZE", label: "Delete & anonymize account", destructive: true });
  return options;
}

function errorMessage(payload: unknown, fallback: string): string {
  const error = (payload as { error?: { message?: unknown } } | null)?.error;
  return typeof error?.message === "string" && error.message ? error.message : fallback;
}

export function AdminUserControlDialog({
  user,
  capabilities,
  onClose,
  onChanged,
}: {
  user: AdminUserRow;
  capabilities: AdminUserControlCapabilities;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const options = useMemo(() => actionOptions(capabilities), [capabilities]);
  const [action, setAction] = useState<UserControlAction>(options[0]?.value ?? "NOTE");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("86400000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sanctions, setSanctions] = useState<AdminUserSanction[]>([]);
  const [loadingSanctions, setLoadingSanctions] = useState(false);

  async function loadSanctions() {
    setLoadingSanctions(true);
    try {
      const response = await fetch(
        `/api/admin/moderation/users/${encodeURIComponent(user.id)}/sanctions`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as {
        sanctions?: AdminUserSanction[];
      } | null;
      setSanctions(response.ok && Array.isArray(payload?.sanctions) ? payload.sanctions : []);
    } finally {
      setLoadingSanctions(false);
    }
  }

  useEffect(() => {
    void loadSanctions();
  }, [user.id]);

  async function submitControl() {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 3) {
      setError("Enter a moderation reason of at least 3 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let url = "/api/admin/moderation/action";
      let body: Record<string, unknown> = {
        targetType: "USER",
        targetId: user.id,
        action,
        reason: normalizedReason,
      };
      if (
        action === "SUSPEND" ||
        action === "POSTING_RESTRICTION" ||
        action === "COMMENT_RESTRICTION"
      ) {
        body.durationMs = duration === "permanent" ? null : Number(duration);
      }
      if (action === "REVOKE_SESSIONS") {
        url = `/api/admin/moderation/users/${encodeURIComponent(user.id)}/sessions/revoke`;
        body = { reason: normalizedReason };
      } else if (action === "NOTE") {
        url = `/api/admin/moderation/users/${encodeURIComponent(user.id)}/note`;
        body = { reason: normalizedReason };
      } else if (action === "ANONYMIZE") {
        url = `/api/admin/moderation/users/${encodeURIComponent(user.id)}/anonymize`;
        body = { reason: normalizedReason };
      }
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessage(payload, "The moderation action could not be completed."));
        return;
      }
      const actionLabel =
        options.find((item) => item.value === action)?.label ?? "Moderation action";
      onChanged(`${actionLabel} completed for @${user.username}.`);
      setReason("");
      await loadSanctions();
      if (action === "ANONYMIZE") onClose();
    } catch {
      setError("The moderation action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeSanction(sanction: AdminUserSanction) {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 3) {
      setError("Enter a reason before revoking a sanction.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/moderation/users/${encodeURIComponent(user.id)}/sanctions/${encodeURIComponent(sanction.id)}/revoke`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify({ reason: normalizedReason }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessage(payload, "The sanction could not be revoked."));
        return;
      }
      onChanged(`${sanction.kind.toLowerCase()} sanction revoked for @${user.username}.`);
      setReason("");
      await loadSanctions();
    } finally {
      setBusy(false);
    }
  }

  const activeSanctions = sanctions.filter(
    (sanction) =>
      sanction.revokedAt === null &&
      (sanction.expiresAt === null || sanction.expiresAt > Date.now()),
  );
  const destructive = action === "BAN" || action === "ANONYMIZE";

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={`Moderate @${user.username}`}
      description="Account actions are capability-checked on the server and recorded in the audit log."
    >
      <div className="admin-user-control">
        <div className="admin-user-control__summary">
          <div className="admin-user-control__identity">
            <CosmeticIdentity
              displayName={user.displayName}
              avatarUrl={user.avatarUrl}
              avatarFrame={user.cosmetics?.avatarFrame}
              profileEffect={user.cosmetics?.profileEffect}
              nameFont={user.cosmetics?.nameFont}
              nameEffect={user.cosmetics?.nameEffect}
              visuals={user.cosmetics?.visuals}
              mode="compact"
              nameAs="strong"
            />
            <span>@{user.username}</span>
          </div>
          <Badge>{user.status}</Badge>
        </div>

        <label className="sb-field">
          <span className="sb-field__label">Action</span>
          <select
            className="sb-input"
            value={action}
            onChange={(event) => setAction(event.target.value as UserControlAction)}
          >
            {options.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {action === "SUSPEND" ||
        action === "POSTING_RESTRICTION" ||
        action === "COMMENT_RESTRICTION" ? (
          <label className="sb-field">
            <span className="sb-field__label">Duration</span>
            <select
              className="sb-input"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            >
              <option value="3600000">1 hour</option>
              <option value="86400000">24 hours</option>
              <option value="604800000">7 days</option>
              <option value="2592000000">30 days</option>
              <option value="permanent">Until manually revoked</option>
            </select>
          </label>
        ) : null}

        <Textarea
          label={action === "NOTE" ? "Moderation note" : "Reason"}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={error ?? undefined}
          placeholder="Document why this action is necessary."
          rows={4}
          maxLength={2000}
        />

        {action === "ANONYMIZE" ? (
          <div className="admin-danger-notice" role="alert">
            This removes profile identity, social links, credentials, roles and active sessions
            while preserving public content records under a deleted identity. This action is
            intentionally owner-only.
          </div>
        ) : null}

        <OverlayActionRow>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            loading={busy}
            onClick={() => void submitControl()}
          >
            {options.find((item) => item.value === action)?.label ?? "Apply action"}
          </Button>
        </OverlayActionRow>

        <section className="admin-user-control__sanctions" aria-label="Sanction history">
          <div className="admin-user-control__section-heading">
            <div>
              <strong>Sanctions</strong>
              <span>{activeSanctions.length} active</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              loading={loadingSanctions}
              onClick={() => void loadSanctions()}
            >
              Refresh
            </Button>
          </div>
          {sanctions.length ? (
            <div className="admin-user-control__sanction-list">
              {sanctions.map((sanction) => {
                const active =
                  sanction.revokedAt === null &&
                  (sanction.expiresAt === null || sanction.expiresAt > Date.now());
                return (
                  <div className="admin-user-control__sanction" key={sanction.id}>
                    <div>
                      <div className="product-chip-row">
                        <Badge>{sanction.kind}</Badge>
                        <Badge>
                          {active ? "Active" : sanction.revokedAt ? "Revoked" : "Expired"}
                        </Badge>
                      </div>
                      <p>{sanction.reason}</p>
                      <small>
                        {sanction.actorUsername ? `@${sanction.actorUsername} · ` : ""}
                        {formatDate(sanction.createdAt)} · {formatDate(sanction.expiresAt)}
                      </small>
                    </div>
                    {active && (sanction.kind !== "BAN" || capabilities.ban) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void revokeSanction(sanction)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="product-search-count">No sanctions recorded.</p>
          )}
        </section>
      </div>
    </Modal>
  );
}

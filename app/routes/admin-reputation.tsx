import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import {
  listAchievements,
  listTopReputationUsers,
  listRewardRules,
  lookupLedger,
  type ReputationUserLedger,
} from "../../worker/reputation/admin";
import { hasCapability } from "../../worker/auth/rbac";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { useI18n } from "../i18n/I18nProvider";
import { Badge, Button, Card, Input, Textarea } from "../components/ui";
import { requireAdminPageAccess } from "../data/admin-access";
import { readCsrfToken } from "../data/csrf";
import type { ServerLoaderArgs } from "../data/server-request";

export async function loader({ request, context }: ServerLoaderArgs) {
  const { runtime, authorization } = await requireAdminPageAccess(request, context);
  const userQuery = new URL(request.url).searchParams.get("user")?.trim() ?? "";
  const canManageRules = hasCapability(authorization, "points.manage");
  const canManageAchievements = hasCapability(authorization, "achievement.manage");
  const canAdjustPoints = hasCapability(authorization, "points.adjust");
  const [rules, achievements, topUsers, ledger] = await Promise.all([
    listRewardRules(runtime.db),
    listAchievements(runtime.db),
    listTopReputationUsers(runtime.db, 15),
    userQuery ? lookupLedger(runtime.db, userQuery) : Promise.resolve(null),
  ]);
  return {
    canManageRules,
    canManageAchievements,
    canAdjustPoints,
    rules,
    achievements,
    topUsers,
    ledger: ledger as ReputationUserLedger | null,
    userQuery,
  };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

type MutationErrorPayload = { error?: { message?: string } } | null;

async function mutationError(response: Response, fallback: string): Promise<string | null> {
  if (response.ok) return null;
  const payload = (await response.json().catch(() => null)) as MutationErrorPayload;
  return payload?.error?.message ?? fallback;
}

function formatDate(value: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default function AdminReputationRoute() {
  const {
    canManageRules,
    canManageAchievements,
    canAdjustPoints,
    rules,
    achievements,
    topUsers,
    ledger,
    userQuery,
  } = useLoaderData<LoaderData>();
  const { t } = useI18n();
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingAchievement, setEditingAchievement] =
    useState<LoaderData["achievements"][number] | null>(null);

  async function submitRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageRules || busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy("rule");
    setStatus(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/reputation/rules", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({
          rewardType: data.get("rewardType"),
          amount: Number(data.get("amount")),
          provisional: data.get("provisional") === "on",
          enabled: data.get("enabled") === "on",
          reason: data.get("reason"),
        }),
      });
      const message = await mutationError(response, "The reward rule could not be saved.");
      if (message) {
        setError(message);
        return;
      }
      setStatus("A new reward rule version was recorded.");
      form.reset();
      revalidator.revalidate();
    } finally {
      setBusy(null);
    }
  }

  async function submitAchievement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageAchievements || busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (editingAchievement) data.set("existingAchievementId", editingAchievement.id);
    setBusy("achievement");
    setStatus(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/reputation/achievements", {
        method: "POST",
        headers: { "x-csrf-token": readCsrfToken() },
        body: data,
      });
      const message = await mutationError(
        response,
        "The achievement version could not be saved.",
      );
      if (message) {
        setError(message);
        return;
      }
      setStatus(
        editingAchievement
          ? "A new achievement version was recorded."
          : "A new achievement version was recorded.",
      );
      form.reset();
      setEditingAchievement(null);
      revalidator.revalidate();
    } finally {
      setBusy(null);
    }
  }

  async function submitAdjustment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAdjustPoints || !ledger || busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy("adjustment");
    setStatus(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/points/${encodeURIComponent(ledger.user.id)}/adjust`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify({ amount: Number(data.get("amount")), reason: data.get("reason") }),
        },
      );
      const message = await mutationError(response, "The point adjustment could not be saved.");
      if (message) {
        setError(message);
        return;
      }
      setStatus(`Points adjusted for @${ledger.user.username}.`);
      form.reset();
      revalidator.revalidate();
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="Contribution economy"
        title="Reputation"
        description="Version reward policy, manage achievement milestones and inspect the append-only point ledger without mutating history."
      />

      {status ? (
        <div className="product-presentation-notice" role="status">
          {status}
        </div>
      ) : null}
      {error ? (
        <div className="product-presentation-notice" role="alert">
          {error}
        </div>
      ) : null}

      <section className="admin-section">
        <div className="admin-section__heading">
          <div>
            <span className="product-eyebrow">Reward policy</span>
            <h2>Versioned point rules</h2>
          </div>
          <span className="product-search-count">{rules.length} versions</span>
        </div>
        <div className="admin-table admin-desktop-table" role="table">
          <div className="admin-table__row admin-table__row--header" role="row">
            <span>Reward</span>
            <span>Version</span>
            <span>Points</span>
            <span>Status</span>
            <span>Created</span>
          </div>
          {rules.map((rule) => (
            <div className="admin-table__row" role="row" key={rule.id}>
              <div className="admin-table__copy">
                <strong>{rule.rewardType.replaceAll("_", " ")}</strong>
                <span>{rule.provisional ? "Provisional" : "Final reward"}</span>
              </div>
              <span>v{rule.version}</span>
              <strong>{rule.amount}</strong>
              <Badge tone={rule.status === "ACTIVE" ? "success" : "neutral"}>{rule.status}</Badge>
              <span>{formatDate(rule.createdAt)}</span>
            </div>
          ))}
        </div>
        {canManageRules ? (
          <Card className="admin-surface">
            <form className="product-form-card" onSubmit={(event) => void submitRule(event)}>
              <div className="product-form-grid">
                <label className="sb-field">
                  <span className="sb-field__label">Reward type</span>
                  <select className="sb-input" name="rewardType" defaultValue="ACCEPTED_SOURCE">
                    <option value="ACCEPTED_SOURCE">Accepted source</option>
                    <option value="VERIFIED_SOURCE">Verified source</option>
                  </select>
                </label>
                <Input name="amount" type="number" min={1} max={100000} label="Points" required />
              </div>
              <label className="sb-field">
                <span className="sb-field__label">
                  <input name="provisional" type="checkbox" /> Provisional reward
                </span>
              </label>
              <label className="sb-field">
                <span className="sb-field__label">
                  <input name="enabled" type="checkbox" defaultChecked /> Make this version active
                </span>
              </label>
              <Textarea
                name="reason"
                label="Reason"
                minLength={10}
                maxLength={500}
                required
                placeholder="Explain why the reward policy is changing."
              />
              <Button type="submit" loading={busy === "rule"}>
                Create rule version
              </Button>
            </form>
          </Card>
        ) : null}
      </section>

      <section className="admin-section">
        <div className="admin-section__heading">
          <div>
            <span className="product-eyebrow">Milestones</span>
            <h2>Achievements</h2>
          </div>
          <span className="product-search-count">{achievements.length} versions</span>
        </div>
        <div className="admin-mobile-card-list">
          {achievements.map((achievement) => (
            <Card className="admin-mobile-review-card admin-surface" key={achievement.id}>
              <div className="admin-mobile-review-card__row">
                <strong>
                  {achievement.icon} {achievement.name}
                </strong>
                <Badge tone={achievement.status === "ACTIVE" ? "success" : "neutral"}>
                  {achievement.status}
                </Badge>
              </div>
              <span>
                {achievement.slug} · v{achievement.version}
              </span>
              <p>{achievement.description}</p>
              <small>{achievement.verifiedSourceThreshold} verified sources</small>
              {canManageAchievements ? (
                <div className="admin-integrity-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingAchievement(achievement)}
                  >
                    {t("admin.reputation.edit")}
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
        {canManageAchievements ? (
          <Card className="admin-surface">
            <form
              key={editingAchievement?.id ?? "new"}
              className="product-form-card"
              onSubmit={(event) => void submitAchievement(event)}
            >
              {editingAchievement ? (
                <div className="product-presentation-notice">
                  {t("admin.reputation.editing")}
                </div>
              ) : null}
              <div className="product-form-grid">
                <Input
                  name="slug"
                  label="Slug"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  defaultValue={editingAchievement?.slug ?? ""}
                  required
                />
                <Input
                  name="name"
                  label="Name"
                  defaultValue={editingAchievement?.name ?? ""}
                  required
                />
                <Input
                  name="icon"
                  label="Icon"
                  maxLength={256}
                  defaultValue={editingAchievement?.icon ?? ""}
                  required
                />
                <Input
                  name="threshold"
                  type="number"
                  min={1}
                  max={100000}
                  label="Verified source threshold"
                  defaultValue={editingAchievement?.verifiedSourceThreshold ?? ""}
                  required
                />
              </div>
              <Textarea
                name="description"
                label="Description"
                minLength={5}
                maxLength={300}
                defaultValue={editingAchievement?.description ?? ""}
                required
              />
              <label className="sb-field">
                <span className="sb-field__label">
                  <input
                    name="iconFile"
                    type="file"
                    accept="image/png,image/gif"
                  />
                  {t("admin.reputation.iconUpload")}
                </span>
                <small>{t("admin.reputation.iconHelp")}</small>
              </label>
              <label className="sb-field">
                <span className="sb-field__label">
                  <input
                    name="enabled"
                    type="checkbox"
                    defaultChecked={editingAchievement?.status === "ACTIVE" || !editingAchievement}
                  />{" "}
                  Make this version active
                </span>
              </label>
              <Textarea
                name="reason"
                label="Reason"
                minLength={10}
                maxLength={500}
                required
                placeholder="Explain why this milestone is changing."
              />
              <div className="admin-integrity-actions">
                <Button type="submit" loading={busy === "achievement"}>
                  {editingAchievement
                    ? t("admin.reputation.saveVersion")
                    : t("admin.reputation.createVersion")}
                </Button>
                {editingAchievement ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy === "achievement"}
                    onClick={() => setEditingAchievement(null)}
                  >
                    {t("admin.reputation.cancel")}
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>
        ) : null}
      </section>

      <section className="admin-section">
        <div className="admin-section__heading">
          <div>
            <span className="product-eyebrow">{t("admin.reputation.topTitle")}</span>
            <h2>{t("admin.reputation.topTitle")}</h2>
            <p>{t("admin.reputation.topDescription")}</p>
          </div>
          <span className="product-search-count">{topUsers.length}/15</span>
        </div>
        {topUsers.length ? (
          <div className="admin-reputation-top-list">
            {topUsers.map((user, index) => (
              <a
                className="admin-reputation-top-user"
                href={`/u/${encodeURIComponent(user.username)}`}
                key={user.userId}
              >
                <span className="admin-reputation-top-user__rank">{index + 1}</span>
                {user.avatarUrl ? (
                  <img
                    className="admin-reputation-top-user__avatar"
                    src={user.avatarUrl}
                    alt=""
                    loading="lazy"
                  />
                ) : null}
                <span className="admin-reputation-top-user__copy">
                  <strong>{user.displayName}</strong>
                  <small>@{user.username}</small>
                </span>
                <span className="admin-reputation-top-user__score">
                  {t("admin.reputation.points", { count: user.score })}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <Card className="product-empty-state admin-surface">
            {t("admin.reputation.topEmpty")}
          </Card>
        )}
      </section>

      <section className="admin-section">
        <div className="admin-section__heading">
          <div>
            <span className="product-eyebrow">Ledger</span>
            <h2>User point history</h2>
          </div>
        </div>
        <form className="admin-filter-bar" method="get">
          <Input
            name="user"
            label="User ID or username"
            defaultValue={userQuery}
            placeholder="@username"
          />
          <Button type="submit">Open ledger</Button>
        </form>
        {userQuery && !ledger ? (
          <Card className="product-empty-state admin-surface">No matching user was found.</Card>
        ) : null}
        {ledger ? (
          <>
            <Card className="admin-surface">
              <strong>
                {ledger.user.displayName} (@{ledger.user.username})
              </strong>
              <p>
                Current ledger balance: <strong>{ledger.balance}</strong> points
              </p>
              {canAdjustPoints ? (
                <form
                  className="product-form-card"
                  onSubmit={(event) => void submitAdjustment(event)}
                >
                  <Input
                    name="amount"
                    type="number"
                    min={-100000}
                    max={100000}
                    label="Manual adjustment"
                    required
                  />
                  <Textarea name="reason" label="Reason" minLength={10} maxLength={500} required />
                  <Button type="submit" loading={busy === "adjustment"}>
                    Record adjustment
                  </Button>
                </form>
              ) : null}
            </Card>
            <div className="admin-table admin-desktop-table" role="table">
              <div className="admin-table__row admin-table__row--header" role="row">
                <span>Entry</span>
                <span>Amount</span>
                <span>Reward</span>
                <span>Event</span>
                <span>Created</span>
              </div>
              {ledger.entries.map((entry) => (
                <div className="admin-table__row" role="row" key={entry.id}>
                  <strong>{entry.entryType}</strong>
                  <span>{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</span>
                  <span>{entry.rewardType ?? "Manual"}</span>
                  <span>{entry.sourceEvent ?? "—"}</span>
                  <span>{formatDate(entry.createdAt)}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </AdminShell>
  );
}

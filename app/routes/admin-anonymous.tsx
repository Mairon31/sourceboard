import { useState } from "react";
import { useLoaderData, useParams } from "react-router";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { PresentationNotice } from "../components/product/ProductShell";
import { Badge, Button, Card, Textarea } from "../components/ui";
import { requireAdminPageAccess } from "../data/admin-access";
import type { ServerLoaderArgs } from "../data/server-request";

export async function loader({ request, context }: ServerLoaderArgs) {
  await requireAdminPageAccess(request, context);
  return { authorized: true as const };
}

function readCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("__Host-sourceboard_csrf="));
  return cookie ? decodeURIComponent(cookie.slice("__Host-sourceboard_csrf=".length)) : "";
}

export default function AdminAnonymousRoute() {
  useLoaderData<typeof loader>();
  const { postId = "" } = useParams();
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "revealed" | "unavailable">("idle");
  const [username, setUsername] = useState<string | null>(null);
  const canReveal = reason.trim().length >= 10;

  async function revealIdentity() {
    setStatus("loading");
    setUsername(null);
    try {
      const response = await fetch(
        `/api/admin/anonymous-posts/${encodeURIComponent(postId)}/reveal-author`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": readCsrfToken(),
          },
          body: JSON.stringify({ reason: reason.trim() }),
        },
      );
      if (!response.ok) {
        setStatus("unavailable");
        return;
      }
      const result = (await response.json()) as { author?: { username?: string } };
      setUsername(result.author?.username ?? null);
      setStatus(result.author?.username ? "revealed" : "unavailable");
    } catch {
      setStatus("unavailable");
    }
  }

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="Privileged access"
        title="Anonymous author"
        description="Public anonymity is preserved. Identity access is a privileged, reason-gated administrative operation."
      />

      <Card className="admin-reveal-card">
        <div className="admin-reveal-state">
          <div>
            <Badge>Identity protected</Badge>
            <strong>
              {status === "revealed" ? "Identity revealed for this audit" : "Anonymous Author"}
            </strong>
            <span>
              {status === "revealed" && username
                ? `Internal account: ${username}`
                : "The public product must not correlate this post with a profile."}
            </span>
          </div>
        </div>

        <Textarea
          label="Reason for access"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setStatus("idle");
          }}
          placeholder="Describe the abuse-prevention or moderation need…"
          hint="Every lookup is capability-checked and written to the audit log."
        />

        <Button disabled={!canReveal || status === "loading"} onClick={revealIdentity}>
          {status === "loading" ? "Checking access…" : "Reveal identity"}
        </Button>

        {status === "unavailable" ? (
          <div className="product-store-preview-status" role="status">
            Identity access is unavailable or not authorized for this account.
          </div>
        ) : null}

        <PresentationNotice>
          The public post and its metadata remain anonymized. This view never uses the public DTO to
          expose identity.
        </PresentationNotice>
      </Card>
    </AdminShell>
  );
}

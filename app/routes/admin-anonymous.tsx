import { useState } from "react";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { Badge, Button, Card, Textarea } from "../components/ui";
import { PresentationNotice } from "../components/product/ProductShell";

export default function AdminAnonymousRoute() {
  const [reason, setReason] = useState("");
  const [revealed, setRevealed] = useState(false);
  const canReveal = reason.trim().length >= 10;

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
            <strong>{revealed ? "Presentation-only identity preview" : "Anonymous Author"}</strong>
            <span>
              {revealed
                ? "No real private identity is exposed by this fixture."
                : "The public product must not correlate this post with a profile."}
            </span>
          </div>
        </div>

        <Textarea
          label="Reason for access"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setRevealed(false);
          }}
          placeholder="Describe the abuse-prevention or moderation need…"
          hint="Production access will record actor, post, timestamp and reason in audit logs."
        />

        <Button disabled={!canReveal} onClick={() => setRevealed(true)}>
          Reveal identity
        </Button>

        {revealed ? (
          <div className="product-store-preview-status">
            Access would be audited in the production system.
          </div>
        ) : null}

        <PresentationNotice>
          Phase 0B intentionally does not contain or expose a real deanonymization backend.
        </PresentationNotice>
      </Card>
    </AdminShell>
  );
}

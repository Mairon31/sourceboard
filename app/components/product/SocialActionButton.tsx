import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "../ui";

function readCsrfToken(): string {
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("__Host-sourceboard_csrf="));
  return entry ? decodeURIComponent(entry.slice("__Host-sourceboard_csrf=".length)) : "";
}

export function SocialActionButton({
  endpoint,
  method,
  children,
  onSuccess,
  variant = "ghost",
  successLabel,
}: {
  endpoint: string;
  method: "POST" | "DELETE";
  children: ReactNode;
  onSuccess: () => void;
  variant?: "secondary" | "ghost";
  successLabel?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function submit() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "x-csrf-token": readCsrfToken() },
      });
      if (!response.ok) {
        setError(true);
        return;
      }
      setCompleted(true);
      onSuccess();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <Button
        variant={variant}
        size="sm"
        loading={busy}
        disabled={completed}
        onClick={() => void submit()}
      >
        {completed ? (successLabel ?? children) : children}
      </Button>
      {error ? <span className="product-store-preview-status">Could not save.</span> : null}
    </span>
  );
}

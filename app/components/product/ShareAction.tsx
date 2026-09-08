import { useState } from "react";
import { Button } from "../ui";
import { ShareIcon } from "../ui/icons";

export interface ShareActionProps {
  url: string;
  title?: string;
  text?: string;
}

export function ShareAction({ url, title, text }: ShareActionProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function share() {
    setBusy(true);
    setStatus("idle");
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ url, title, text });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setStatus("copied");
      } else {
        throw new Error("Sharing is not available in this browser.");
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setStatus(cause instanceof Error ? "error" : "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="product-share-action">
      <Button variant="ghost" loading={busy} onClick={share} aria-label="Share">
        <ShareIcon width="16" height="16" />
        <span>{status === "copied" ? "Copied" : "Share"}</span>
      </Button>
      {status === "error" ? <span role="alert">Unable to share.</span> : null}
    </span>
  );
}

import { useState } from "react";
import { readCsrfToken } from "../../data/csrf";
import { Button } from "../ui";
import { ShareIcon } from "../ui/icons";

export interface ShareActionProps {
  url: string;
  title?: string;
  text?: string;
}

type ShareRewardTarget = { targetType: "POST" | "COMMENT" | "PROFILE"; targetId: string };

function shareRewardTarget(value: string): ShareRewardTarget | null {
  try {
    const url = new URL(value, typeof window === "undefined" ? "https://srcboard.me" : window.location.href);
    const comment = url.hash.match(/^#comment-(.+)$/);
    if (comment?.[1]) {
      return { targetType: "COMMENT", targetId: decodeURIComponent(comment[1]) };
    }
    const post = url.pathname.match(/^\/posts\/([^/]+)/);
    if (post?.[1]) return { targetType: "POST", targetId: decodeURIComponent(post[1]) };
    const profile = url.pathname.match(/^\/u\/([^/]+)/);
    if (profile?.[1]) return { targetType: "PROFILE", targetId: decodeURIComponent(profile[1]) };
  } catch {
    // Sharing still works even when a URL is not eligible for points.
  }
  return null;
}

function recordShareIntent(resolvedUrl: string): void {
  const target = shareRewardTarget(resolvedUrl);
  if (!target) return;
  void fetch("/api/reputation/share-intent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
    body: JSON.stringify(target),
  }).catch(() => undefined);
}

export function ShareAction({ url, title, text }: ShareActionProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function share() {
    setBusy(true);
    setStatus("idle");
    try {
      const resolvedUrl =
        typeof window !== "undefined" ? new URL(url, window.location.href).toString() : url;
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ url: resolvedUrl, title, text });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(resolvedUrl);
        setStatus("copied");
      } else {
        throw new Error("Sharing is not available in this browser.");
      }
      recordShareIntent(resolvedUrl);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setStatus("error");
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

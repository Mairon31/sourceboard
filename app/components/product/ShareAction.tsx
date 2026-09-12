import { useState } from "react";
import { readCsrfToken } from "../../data/csrf";
import { Button } from "../ui";
import { ShareIcon } from "../ui/icons";

const SHARE_LOCALES = new Set(["en", "es", "pt", "fr", "ru", "de"]);

type StableShareTarget = { resourceType: "POST" | "COMMENT"; resourceId: string };

export interface ShareActionProps {
  url: string;
  title?: string;
  text?: string;
  target?: StableShareTarget;
}

type ShareRewardTarget = { targetType: "POST" | "COMMENT" | "PROFILE"; targetId: string };

function shareRewardTarget(value: string): ShareRewardTarget | null {
  try {
    const url = new URL(
      value,
      typeof window === "undefined" ? "https://srcboard.me" : window.location.href,
    );
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

function recordShareIntent(resolvedUrl: string, stableTarget?: StableShareTarget): void {
  const target: ShareRewardTarget | null = stableTarget
    ? { targetType: stableTarget.resourceType, targetId: stableTarget.resourceId }
    : shareRewardTarget(resolvedUrl);
  if (!target) return;
  void fetch("/api/reputation/share-intent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
    body: JSON.stringify(target),
  }).catch(() => undefined);
}

async function resolveStableShareUrl(url: string, target?: StableShareTarget): Promise<string> {
  const canonicalUrl =
    typeof window !== "undefined" ? new URL(url, window.location.href).toString() : url;
  if (!target || typeof window === "undefined") return canonicalUrl;

  const response = await fetch("/api/share-links", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
    body: JSON.stringify(target),
  });
  if (!response.ok) {
    if (response.status >= 500) return canonicalUrl;
    throw new Error("Share target is unavailable.");
  }

  const payload = (await response.json()) as { shortUrl?: string };
  if (!payload.shortUrl) throw new Error("Share link response is invalid.");
  const shortUrl = new URL(payload.shortUrl, window.location.href);
  const locale = new URL(window.location.href).searchParams.get("lang");
  if (locale && SHARE_LOCALES.has(locale)) shortUrl.searchParams.set("lang", locale);
  return shortUrl.toString();
}

export function ShareAction({ url, title, text, target }: ShareActionProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function share() {
    setBusy(true);
    setStatus("idle");
    try {
      const resolvedUrl = await resolveStableShareUrl(url, target);
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ url: resolvedUrl, title, text });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(resolvedUrl);
        setStatus("copied");
      } else {
        throw new Error("Sharing is not available in this browser.");
      }
      recordShareIntent(resolvedUrl, target);
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

const navigationStarts = new Map<string, string>();
let navigationSequence = 0;

export type NavigationFamily =
  | "home"
  | "store"
  | "friends"
  | "notifications"
  | "profile"
  | "post"
  | "post-new"
  | "search"
  | "settings"
  | "admin"
  | "auth"
  | "other";

export function classifyNavigationPath(pathname: string): NavigationFamily {
  if (pathname === "/") return "home";
  if (pathname === "/store") return "store";
  if (pathname === "/friends") return "friends";
  if (pathname === "/notifications") return "notifications";
  if (pathname === "/post/new") return "post-new";
  if (pathname === "/search" || pathname.startsWith("/search?")) return "search";
  if (pathname === "/settings") return "settings";
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/verify-email"
  )
    return "auth";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/posts" || pathname.startsWith("/posts/") || pathname.startsWith("/post/"))
    return "post";
  if (pathname.startsWith("/u/") || pathname.startsWith("/profile/")) return "profile";
  return "other";
}

function browserPerformance(): Performance | null {
  return typeof performance === "undefined" ? null : performance;
}

export function markNavigationStart(to: string): NavigationFamily {
  const family = classifyNavigationPath(to.split("?", 1)[0] ?? to);
  const currentPerformance = browserPerformance();
  if (!currentPerformance) return family;

  const markName = `sourceboard:navigation:${family}:start:${++navigationSequence}`;
  currentPerformance.mark(markName);
  navigationStarts.set(family, markName);
  return family;
}

export function markNavigationReady(pathname: string): NavigationFamily {
  const family = classifyNavigationPath(pathname.split("?", 1)[0] ?? pathname);
  const currentPerformance = browserPerformance();
  const startMark = navigationStarts.get(family);
  if (!currentPerformance || !startMark) return family;

  const endMark = `sourceboard:navigation:${family}:ready:${++navigationSequence}`;
  currentPerformance.mark(endMark);
  try {
    currentPerformance.measure(`sourceboard:navigation:${family}`, startMark, endMark);
  } finally {
    currentPerformance.clearMarks(startMark);
    currentPerformance.clearMarks(endMark);
    navigationStarts.delete(family);
  }
  return family;
}

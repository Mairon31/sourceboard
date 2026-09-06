function routeFamily(pathname: string): string {
  if (pathname.startsWith("/api/auth")) return "auth";
  if (pathname.startsWith("/api/posts") || pathname.startsWith("/api/media/post")) return "posts";
  if (pathname.startsWith("/api/comments") || pathname.startsWith("/api/reactions")) {
    return "comments-reactions";
  }
  if (pathname.startsWith("/api/profile") || pathname.startsWith("/api/friends"))
    return "profile-social";
  if (pathname.startsWith("/api/notifications")) return "notifications";
  if (pathname.startsWith("/api/admin")) return "admin";
  if (pathname.startsWith("/api/search")) return "search";
  if (pathname.startsWith("/api/")) return "api-other";
  if (pathname.startsWith("/posts/")) return "post-page";
  if (pathname.startsWith("/u/") || pathname.startsWith("/profile/")) return "profile-page";
  return pathname === "/" ? "home" : "page";
}

export function observeRequest(request: Request, response: Response, startedAt: number): void {
  console.info(
    JSON.stringify({
      event: "http_request",
      route: routeFamily(new URL(request.url).pathname),
      method: request.method,
      status: response.status,
      durationMs: Math.max(0, Date.now() - startedAt),
      requestId: response.headers.get("x-request-id") ?? null,
    }),
  );
}

export function observeBackgroundFailure(component: string): void {
  console.error(JSON.stringify({ event: "background_failure", component }));
}

export { routeFamily };

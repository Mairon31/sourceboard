export const SOURCEBOARD_ORIGIN = "https://srcboard.me";

export function absoluteSourceBoardUrl(path: string): string {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return new URL(safePath, SOURCEBOARD_ORIGIN).toString();
}

export function canonicalPostUrl(id: string, slug: string): string {
  return absoluteSourceBoardUrl(`/posts/${encodeURIComponent(id)}/${encodeURIComponent(slug)}`);
}

export function canonicalProfileUrl(username: string): string {
  return absoluteSourceBoardUrl(`/u/${encodeURIComponent(username)}`);
}

export function canonicalUgcUrl(_requestUrl: string, canonicalPath: string): string {
  const url = new URL(canonicalPath, SOURCEBOARD_ORIGIN);
  url.search = "";
  url.hash = "";
  return url.toString();
}

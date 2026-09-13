import { isLocale } from "../../shared/i18n/locales";
import { assertCsrfToken, assertSameOrigin } from "../../worker/auth/security";
import { readSourceBoardRequestContext } from "../../shared/router-context";
import { localeCookie } from "../data/locale.server";
import { readServerSession, type ServerLoaderArgs } from "../data/server-request";

export async function action({ request, context }: ServerLoaderArgs) {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  try {
    assertSameOrigin(request);
    assertCsrfToken(request);
  } catch {
    return Response.json({ error: { code: "LOCALE_SECURITY", message: "Request validation failed." } }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  const localeCandidate = typeof body?.locale === "string" ? body.locale : null;
  if (!isLocale(localeCandidate)) {
    return Response.json({ error: { code: "LOCALE_INVALID", message: "Unsupported locale." } }, { status: 400 });
  }
  const locale = localeCandidate;
  const requestContext = readSourceBoardRequestContext(context);
  const session = await readServerSession(request, context).catch(() => null);
  if (session && requestContext?.env.DB) {
    const now = Date.now();
    await requestContext.env.DB.prepare(
      `INSERT INTO user_preferences (
        user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests,
        notify_activity, notify_friendships, created_at, updated_at, locale
      ) VALUES (?, 1, 1, 0, 1, 1, 1, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET locale = excluded.locale, updated_at = excluded.updated_at`,
    )
      .bind(session.user.id, now, now, locale)
      .run();
  }

  const secure = new URL(request.url).protocol === "https:";
  return Response.json(
    { locale },
    { headers: { "cache-control": "no-store", "set-cookie": localeCookie(locale, secure) } },
  );
}

export default function LocalePreferenceResource() {
  return null;
}

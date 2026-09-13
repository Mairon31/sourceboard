import { redirect } from "react-router";
import { requestedLocale } from "../data/locale.server";
import type { ServerLoaderArgs } from "../data/server-request";

export async function loader({ request }: ServerLoaderArgs) {
  const source = new URL(request.url);
  const locale = requestedLocale(request);
  const dataPathname = source.pathname.replace(/\.data$/, "");
  const pathname = dataPathname === "/_" ? "" : dataPathname.endsWith("/_") ? dataPathname.slice(0, -2) : dataPathname === "/" ? "" : dataPathname;
  source.searchParams.delete("lang");
  const search = source.searchParams.size ? `?${source.searchParams.toString()}` : "";
  throw redirect(`/${locale}${pathname}${search}`, 302);
}

export default function OfficialAliasRoute() {
  return null;
}
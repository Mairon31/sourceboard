import { redirect } from "react-router";
import type { ServerLoaderArgs } from "../data/server-request";

interface LoaderArgs extends ServerLoaderArgs {
  params: { username?: string };
}

export async function loader({ params }: LoaderArgs) {
  const username = params.username?.trim();
  if (!username) throw new Response("Profile not found", { status: 404 });
  return redirect(`/u/${encodeURIComponent(username)}`, 301);
}

export default function LegacyProfileRoute() {
  return null;
}

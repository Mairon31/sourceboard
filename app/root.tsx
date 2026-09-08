import type { ReactNode } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  type MetaFunction,
} from "react-router";
import { THEME_INIT_SCRIPT } from "../shared/design/theme";
import { readSourceBoardRequestContext } from "../shared/router-context";
import { readServerSession, type ServerLoaderArgs } from "./data/server-request";
import "./styles/base.css";
import "./styles/motion-preferences.css";
import "./components/ui/ui.css";
import "./components/layout/layout.css";
import "./components/layout/notification-popover.css";
import "./components/product/product.css";
import "./components/product/home-redesign.css";
import "./components/product/search-redesign.css";
import "./components/product/settings-redesign.css";
import "./components/product/post-media.css";
import "./components/product/post-card-refresh.css";
import "./components/product/product-interactions.css";
import "./components/product/comment-actions.css";
import "./components/product/source-resolution.css";
import "./components/product/notifications.css";
import "./components/product/store.css";
import "./components/product/store-page.css";
import "./components/product/store-responsive.css";
import "./components/product/store-effects.css";
import "./components/product/name-effect-extras.css";
import "./components/product/custom-cosmetics.css";
import "./components/product/cosmetic-identity.css";
import "./components/product/profile-klipy.css";
import "./components/product/docs-system.css";
import "./components/admin/admin.css";
import "./components/admin/store/admin-store.css";
import "./components/product/visual-overhaul.css";
import "./components/product/profile-summary.css";
import "./components/product/mobile-product-polish.css";
import "./components/product/profile-layout-polish.css";
import "./components/product/store-mobile-polish.css";
import "./components/product/post-layout-polish.css";
import "./components/product/friends-page-polish.css";

// fallow-ignore-next-line complexity -- route loader combines request context and session recovery.
export async function loader({ request, context }: ServerLoaderArgs) {
  const requestContext = readSourceBoardRequestContext(context);
  const session = await readServerSession(request, context)
    .then((current) => (current ? { user: current.user } : null))
    .catch(() => null);

  return {
    cspNonce: requestContext?.cspNonce ?? null,
    origin: "https://srcboard.me",
    // fallow-ignore-next-line unused-load-data-key -- ProductNav reads this root loader through useRouteLoaderData.
    session,
  };
}

export type RootLoaderData = Awaited<ReturnType<typeof loader>>;

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const origin = loaderData?.origin ?? "https://srcboard.me";
  const logoUrl = new URL("/sourceboard-og.png", origin).toString();
  return [
    { title: "SourceBoard" },
    {
      name: "description",
      content: "Find the original source of an image with evidence from the community.",
    },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "SourceBoard" },
    { property: "og:title", content: "SourceBoard" },
    {
      property: "og:description",
      content: "Find the original source of an image with evidence from the community.",
    },
    { property: "og:url", content: origin },
    { property: "og:image", content: logoUrl },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "SourceBoard" },
    { name: "twitter:image", content: logoUrl },
  ];
};

export const links = () => [
  { rel: "icon", type: "image/svg+xml", href: "/sourceboard-logo.svg" },
  { rel: "apple-touch-icon", href: "/sourceboard-og.png" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { cspNonce } = useLoaderData<RootLoaderData>();
  const nonce = cspNonce ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>SourceBoard</title>
        <Meta />
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <Links nonce="" />
      </head>
      <body>
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

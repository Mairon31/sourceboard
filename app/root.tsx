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
import type { ServerLoaderArgs } from "./data/server-request";
import "./styles/base.css";
import "./components/ui/ui.css";
import "./components/layout/layout.css";
import "./components/product/product.css";
import "./components/admin/admin.css";

export function loader({ context }: ServerLoaderArgs) {
  return {
    cspNonce: readSourceBoardRequestContext(context)?.cspNonce ?? null,
    origin: "https://srcboard.me",
  };
}

type LoaderData = ReturnType<typeof loader>;

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const origin = loaderData?.origin ?? "https://srcboard.me";
  const logoUrl = new URL("/sourceboard-logo.png", origin).toString();
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
  { rel: "icon", type: "image/png", href: "/sourceboard-logo.png", sizes: "1254x1254" },
  { rel: "apple-touch-icon", href: "/sourceboard-logo.png", sizes: "1254x1254" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { cspNonce } = useLoaderData<LoaderData>();
  const nonce = cspNonce ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>SourceBoard</title>
        <Meta />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Links nonce={nonce} />
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

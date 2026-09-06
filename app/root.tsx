import type { ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "react-router";
import { THEME_INIT_SCRIPT } from "../shared/design/theme";
import { readSourceBoardRequestContext } from "../shared/router-context";
import type { ServerLoaderArgs } from "./data/server-request";
import "./styles/base.css";
import "./components/ui/ui.css";
import "./components/layout/layout.css";
import "./components/product/product.css";
import "./components/admin/admin.css";

export function loader({ context }: ServerLoaderArgs) {
  return { cspNonce: readSourceBoardRequestContext(context)?.cspNonce ?? null };
}

type LoaderData = ReturnType<typeof loader>;

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

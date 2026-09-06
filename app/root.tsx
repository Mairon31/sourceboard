import type { ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { THEME_INIT_SCRIPT } from "../shared/design/theme";
import "./styles/base.css";
import "./components/ui/ui.css";
import "./components/layout/layout.css";
import "./components/demo/demo.css";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

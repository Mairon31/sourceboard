import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { ThemeControl } from "../layout/ThemeControl";

const adminLinks = [
  { href: "/admin", label: "Overview", end: true },
  { href: "/admin/moderation", label: "Moderation", end: false },
  { href: "/admin/verifications", label: "Verifications", end: false },
  { href: "/admin#users", label: "Users", end: false },
  { href: "/admin#roles", label: "Roles", end: false },
  { href: "/admin#source-verification", label: "Source verification", end: false },
  { href: "/admin/store", label: "Store", end: false },
  { href: "/admin#audit", label: "Audit", end: false },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const [uiReady, setUiReady] = useState(false);

  useEffect(() => {
    setUiReady(true);
  }, []);

  return (
    <div className="admin-shell" data-ui-ready={uiReady ? "true" : "false"}>
      <aside className="admin-sidebar">
        <a href="/" className="admin-brand">
          <span aria-hidden="true">
            <img src="/sourceboard-logo.svg" alt="" width="34" height="34" decoding="async" />
          </span>
          <strong>SourceBoard</strong>
        </a>
        <div className="admin-sidebar__label">Administration</div>
        <nav aria-label="Administration navigation">
          {adminLinks.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.end}
              className={({ isActive }) =>
                `admin-nav-link${isActive ? " admin-nav-link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar__footer">
          <ThemeControl />
          <a href="/">Back to site</a>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="admin-page-header">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="admin-page-header__actions">{actions}</div> : null}
    </header>
  );
}

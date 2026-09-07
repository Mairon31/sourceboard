import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { ThemeControl } from "../layout/ThemeControl";
import {
  CheckIcon,
  FriendsIcon,
  HomeIcon,
  InfoIcon,
  SearchIcon,
  StoreIcon,
  UserIcon,
} from "../ui";

const adminLinks = [
  { href: "/admin", label: "Overview", end: true, icon: HomeIcon },
  {
    href: "/admin/moderation",
    label: "Moderation",
    end: false,
    icon: InfoIcon,
  },
  {
    href: "/admin/verifications",
    label: "Verifications",
    end: false,
    icon: CheckIcon,
  },
  { href: "/admin/users", label: "Users", end: false, icon: UserIcon },
  { href: "/admin/roles", label: "Roles", end: false, icon: FriendsIcon },
  { href: "/admin/store", label: "Store", end: false, icon: StoreIcon },
  { href: "/admin/audit", label: "Audit", end: false, icon: SearchIcon },
] as const;

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
            <img
              src="/sourceboard-logo.svg"
              alt=""
              width="34"
              height="34"
              decoding="async"
            />
          </span>
          <div>
            <strong>SourceBoard</strong>
            <small>Control center</small>
          </div>
        </a>
        <div className="admin-sidebar__label">Administration</div>
        <nav aria-label="Administration navigation">
          {adminLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.end}
                className={({ isActive }) =>
                  `admin-nav-link${isActive ? " admin-nav-link--active" : ""}`
                }
              >
                <Icon width="18" height="18" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
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

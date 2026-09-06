import { NavLink, useRouteLoaderData } from "react-router";
import { ThemeControl } from "../layout/ThemeControl";
import type { RootLoaderData } from "../../root";

const primaryLinks = [
  { href: "/", label: "Home", short: "Home" },
  { href: "/friends", label: "Friends", short: "Friends" },
  { href: "/notifications", label: "Notifications", short: "Alerts" },
  { href: "/store", label: "Store", short: "Store" },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `product-nav__link${isActive ? " product-nav__link--active" : ""}`;
}

export function ProductNav() {
  const rootData = useRouteLoaderData<RootLoaderData>("root");
  const user = rootData?.session?.user ?? null;

  return (
    <nav className="product-nav" aria-label="Primary navigation">
      <div className="product-nav__links">
        {primaryLinks.map((item) => (
          <NavLink key={item.href} to={item.href} className={navClass} end={item.href === "/"}>
            <span className="product-nav__dot" aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      <NavLink className="product-nav__create" to="/post/new">
        Create post
      </NavLink>

      <div className="product-nav__account">
        {user ? (
          <NavLink className={navClass} to={`/u/${encodeURIComponent(user.username)}`}>
            <span className="product-nav__avatar" aria-hidden="true">
              {user.username.slice(0, 2).toUpperCase()}
            </span>
            <span>{user.username}</span>
          </NavLink>
        ) : (
          <NavLink className={navClass} to="/login">
            <span className="product-nav__dot" aria-hidden="true" />
            <span>Sign in</span>
          </NavLink>
        )}
        <NavLink className={navClass} to="/settings">
          <span className="product-nav__dot" aria-hidden="true" />
          <span>Settings</span>
        </NavLink>
      </div>
    </nav>
  );
}

export function MobileProductNav() {
  return (
    <nav
      className="product-mobile-nav glass-panel glass-panel--strong"
      aria-label="Mobile navigation"
    >
      {primaryLinks.slice(0, 2).map((item) => (
        <NavLink key={item.href} to={item.href} className={navClass} end={item.href === "/"}>
          {item.short}
        </NavLink>
      ))}
      <NavLink className="product-mobile-nav__create" to="/post/new" aria-label="Create post">
        +
      </NavLink>
      {primaryLinks.slice(2).map((item) => (
        <NavLink key={item.href} to={item.href} className={navClass}>
          {item.short}
        </NavLink>
      ))}
    </nav>
  );
}

export function ProductContextRail() {
  return (
    <div className="product-context-rail">
      <section className="product-context-card">
        <span className="product-eyebrow">SourceBoard</span>
        <h2>Search with context</h2>
        <p>
          Good requests include where you found the image, what reverse-search tools you tried and
          what kind of source you need.
        </p>
      </section>
      <section className="product-context-card product-context-card--quiet">
        <h2>Production community</h2>
        <p>Source requests are connected to the community service.</p>
      </section>
      <div className="product-context-theme">
        <span>Appearance</span>
        <ThemeControl />
      </div>
    </div>
  );
}

import { NavLink } from "react-router";
import { ThemeControl } from "../layout/ThemeControl";

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
        <NavLink className={navClass} to="/profile/aurora">
          <span className="product-nav__avatar" aria-hidden="true">
            AV
          </span>
          <span>Aurora Vale</span>
        </NavLink>
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
        <h2>Presentation build</h2>
        <p>Phase 0B uses typed fixture data. Authentication and persistence are not active yet.</p>
      </section>
      <div className="product-context-theme">
        <span>Appearance</span>
        <ThemeControl />
      </div>
    </div>
  );
}

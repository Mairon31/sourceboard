import { NavLink, useRouteLoaderData } from "react-router";
import { ThemeControl } from "../layout/ThemeControl";
import { FriendsIcon, HomeIcon, PlusIcon, StoreIcon, UserIcon } from "../ui";
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
          <NavLink
            key={item.href}
            to={item.href}
            className={navClass}
            end={item.href === "/"}
            prefetch="intent"
          >
            <span className="product-nav__dot" aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      <NavLink className="product-nav__create" to="/post/new" prefetch="intent">
        Create post
      </NavLink>

      <div className="product-nav__account">
        {user ? (
          <NavLink
            className={navClass}
            to={`/u/${encodeURIComponent(user.username)}`}
            prefetch="intent"
          >
            <span className="product-nav__avatar" aria-hidden="true">
              {user.username.slice(0, 2).toUpperCase()}
            </span>
            <span>{user.username}</span>
          </NavLink>
        ) : (
          <NavLink className={navClass} to="/login" prefetch="intent">
            <span className="product-nav__dot" aria-hidden="true" />
            <span>Sign in</span>
          </NavLink>
        )}
        <NavLink className={navClass} to="/settings" prefetch="intent">
          <span className="product-nav__dot" aria-hidden="true" />
          <span>Settings</span>
        </NavLink>
      </div>
    </nav>
  );
}

export function MobileProductNav() {
  const rootData = useRouteLoaderData<RootLoaderData>("root");
  const user = rootData?.session?.user ?? null;
  const profileHref = user ? `/u/${encodeURIComponent(user.username)}` : "/login";

  return (
    <nav
      className="product-mobile-nav glass-panel glass-panel--strong"
      aria-label="Mobile navigation"
    >
      <NavLink to="/" className={navClass} end aria-label="Home" title="Home" prefetch="viewport">
        <HomeIcon />
      </NavLink>
      <NavLink
        to="/friends"
        className={navClass}
        aria-label="Friends"
        title="Friends"
        prefetch="viewport"
      >
        <FriendsIcon />
      </NavLink>
      <NavLink
        className="product-mobile-nav__create"
        to="/post/new"
        aria-label="Create post"
        title="Create post"
        prefetch="viewport"
      >
        <PlusIcon />
      </NavLink>
      <NavLink
        to={profileHref}
        className={navClass}
        aria-label="Profile"
        title="Profile"
        prefetch="viewport"
      >
        <UserIcon />
      </NavLink>
      <NavLink
        to="/store"
        className={navClass}
        aria-label="Store"
        title="Store"
        prefetch="viewport"
      >
        <StoreIcon />
      </NavLink>
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

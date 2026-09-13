import { NavLink, useRouteLoaderData } from "react-router";
import { ThemeControl } from "../layout/ThemeControl";
import { FriendsIcon, HomeIcon, PlusIcon, StoreIcon, UserIcon } from "../ui";
import type { RootLoaderData } from "../../root";
import { markNavigationStart } from "../../data/performance-metrics";
import { useI18n } from "../../i18n/I18nProvider";

const primaryLinks = [
  { href: "/", key: "nav.home" as const },
  { href: "/friends", key: "nav.friends" as const },
  { href: "/notifications", key: "nav.notifications" as const },
  { href: "/store", key: "nav.store" as const },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `product-nav__link${isActive ? " product-nav__link--active" : ""}`;
}

export function ProductNav() {
  const rootData = useRouteLoaderData<RootLoaderData>("root");
  const user = rootData?.session?.user ?? null;
  const { t } = useI18n();

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
            onClick={() => markNavigationStart(item.href)}
          >
            <span className="product-nav__dot" aria-hidden="true" />
            <span>{t(item.key)}</span>
          </NavLink>
        ))}
      </div>

      <NavLink
        className="product-nav__create"
        to="/post/new"
        prefetch="intent"
        onClick={() => markNavigationStart("/post/new")}
      >
        {t("nav.create")}
      </NavLink>

      <div className="product-nav__account">
        {user ? (
          <NavLink
            className={navClass}
            to={`/u/${encodeURIComponent(user.username)}`}
            prefetch="intent"
            onClick={() => markNavigationStart("/u/:username")}
          >
            <span className="product-nav__avatar" aria-hidden="true">
              {user.username.slice(0, 2).toUpperCase()}
            </span>
            <span>{user.username}</span>
          </NavLink>
        ) : (
          <NavLink
            className={navClass}
            to="/login"
            prefetch="intent"
            onClick={() => markNavigationStart("/login")}
          >
            <span className="product-nav__dot" aria-hidden="true" />
            <span>{t("auth.login")}</span>
          </NavLink>
        )}
        <NavLink
          className={navClass}
          to="/settings"
          prefetch="intent"
          onClick={() => markNavigationStart("/settings")}
        >
          <span className="product-nav__dot" aria-hidden="true" />
          <span>{t("nav.settings")}</span>
        </NavLink>
      </div>
    </nav>
  );
}

export function MobileProductNav() {
  const rootData = useRouteLoaderData<RootLoaderData>("root");
  const user = rootData?.session?.user ?? null;
  const profileHref = user ? `/u/${encodeURIComponent(user.username)}` : "/login";
  const { t } = useI18n();

  return (
    <nav
      className="product-mobile-nav glass-panel glass-panel--strong"
      aria-label="Primary navigation"
    >
      <NavLink
        to="/"
        className={navClass}
        end
        aria-label={t("nav.home")}
        title={t("nav.home")}
        prefetch="intent"
        onClick={() => markNavigationStart("/")}
      >
        <HomeIcon />
      </NavLink>
      <NavLink
        to="/friends"
        className={navClass}
        aria-label={t("nav.friends")}
        title={t("nav.friends")}
        prefetch="intent"
        onClick={() => markNavigationStart("/friends")}
      >
        <FriendsIcon />
      </NavLink>
      <NavLink
        className="product-mobile-nav__create"
        to="/post/new"
        aria-label={t("nav.create")}
        title={t("nav.create")}
        prefetch="intent"
        onClick={() => markNavigationStart("/post/new")}
      >
        <PlusIcon />
      </NavLink>
      <NavLink
        to={profileHref}
        className={navClass}
        aria-label={t("nav.profile")}
        title={t("nav.profile")}
        prefetch="intent"
        onClick={() => markNavigationStart(profileHref)}
      >
        <UserIcon />
      </NavLink>
      <NavLink
        to="/store"
        className={navClass}
        aria-label={t("nav.store")}
        title={t("nav.store")}
        prefetch="intent"
        onClick={() => markNavigationStart("/store")}
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

import { Link } from "react-router";
import { useEffect, useState } from "react";
import { BellIcon, SearchIcon } from "../ui";
import { ThemeControl } from "./ThemeControl";

export function TopBar() {
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    void fetch("/api/notifications")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (payload && typeof payload === "object" && "unreadCount" in payload) {
          setUnreadCount(Number(payload.unreadCount) || 0);
        }
      })
      .catch(() => undefined);
  }, []);
  return (
    <header className="sb-topbar glass-panel glass-panel--strong">
      <Link className="sb-brand focus-ring" to="/" aria-label="SourceBoard">
        <span className="sb-brand__mark" aria-hidden="true">
          S
        </span>
        <span className="sb-brand__name">SourceBoard</span>
      </Link>

      <label className="sb-topbar-search">
        <span className="sr-only">Search SourceBoard</span>
        <SearchIcon width="18" height="18" />
        <input
          type="search"
          readOnly
          value=""
          placeholder="Search SourceBoard"
          aria-label="Search SourceBoard"
        />
      </label>

      <div className="sb-topbar-actions">
        <ThemeControl />
        <Link
          to="/notifications"
          aria-label="Notifications"
          className="sb-topbar-notification-link focus-ring"
        >
          <BellIcon width="18" height="18" />
          {unreadCount ? (
            <span
              className="sb-topbar-notification-count"
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}

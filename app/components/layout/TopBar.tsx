import { Link, useNavigate } from "react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BellIcon, SearchIcon } from "../ui";
import {
  notificationWebSocketUrl,
  readNotificationSnapshot,
  reconnectDelay,
  type NotificationPreview,
} from "../../data/notifications-realtime";
import { markNavigationStart } from "../../data/performance-metrics";
import { ThemeControl } from "./ThemeControl";

export function TopBar() {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<NotificationPreview[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const submittedValue = new FormData(event.currentTarget).get("q");
    const query = typeof submittedValue === "string" ? submittedValue.trim() : "";
    markNavigationStart("/search");
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let attempts = 0;

    async function refresh(): Promise<{ authenticated: boolean; lastSeen: string | null }> {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        if (!sessionResponse.ok) return { authenticated: false, lastSeen: null };
        const session = (await sessionResponse.json()) as { authenticated?: unknown };
        if (session.authenticated !== true) return { authenticated: false, lastSeen: null };

        const response = await fetch("/api/notifications");
        if (response.status === 401 || response.status === 403)
          return { authenticated: false, lastSeen: null };
        if (!response.ok) return { authenticated: false, lastSeen: null };
        const snapshot = readNotificationSnapshot(await response.json());
        if (!disposed && snapshot) {
          setUnreadCount(snapshot.unreadCount);
          setRecentNotifications(snapshot.notifications);
        }
        return { authenticated: true, lastSeen: snapshot?.lastSeen ?? null };
      } catch {
        return { authenticated: true, lastSeen: null };
      }
    }

    async function connect(): Promise<void> {
      const state = await refresh();
      if (disposed || !state.authenticated || typeof WebSocket === "undefined") return;
      socket = new WebSocket(notificationWebSocketUrl(window.location, state.lastSeen));
      socket.onopen = () => {
        attempts = 0;
      };
      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        try {
          const message = JSON.parse(event.data) as { type?: unknown };
          if (message.type === "ready" || message.type === "notification") void refresh();
        } catch {
          // Ignore malformed frames; D1 remains the source of truth.
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (disposed) return;
        reconnectTimer = window.setTimeout(() => void connect(), reconnectDelay(++attempts));
      };
    }

    void connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socket?.close(1000, "navigation");
    };
  }, []);

  useEffect(() => {
    if (!notificationsOpen) return;
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") setNotificationsOpen(false);
    }
    function closeOutside(event: PointerEvent): void {
      if (event.target instanceof Node && !notificationMenuRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [notificationsOpen]);

  return (
    <header className="sb-topbar glass-panel glass-panel--strong">
      <Link
        className="sb-brand focus-ring"
        to="/"
        aria-label="SourceBoard"
        onClick={() => markNavigationStart("/")}
      >
        <img
          className="sb-brand__mark"
          src="/sourceboard-logo.svg"
          alt=""
          width="34"
          height="34"
          decoding="async"
        />
        <span className="sb-brand__name">SourceBoard</span>
      </Link>

      <form
        className="sb-topbar-search"
        onSubmit={submitSearch}
        role="search"
        aria-label="Search SourceBoard"
        action="/search"
        method="get"
      >
        <span className="sr-only">Search SourceBoard</span>
        <SearchIcon width="18" height="18" />
        <input
          type="search"
          name="q"
          defaultValue=""
          placeholder="Search SourceBoard"
          aria-label="Search SourceBoard"
        />
      </form>

      <div className="sb-topbar-actions">
        <ThemeControl />
        <div className="sb-topbar-notification" ref={notificationMenuRef}>
          <button
            type="button"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            aria-controls="sourceboard-notification-menu"
            className="sb-topbar-notification-link sb-topbar-notification-trigger focus-ring"
            onClick={() => setNotificationsOpen((open) => !open)}
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
          </button>
          {notificationsOpen ? (
            <div
              id="sourceboard-notification-menu"
              className="sb-topbar-notification-menu glass-panel glass-panel--strong"
              role="dialog"
              aria-label="Recent notifications"
            >
              <div className="sb-topbar-notification-menu__header">
                <strong>Notifications</strong>
                <Link
                  className="sb-topbar-notification-menu__all focus-ring"
                  to="/notifications"
                  onClick={() => markNavigationStart("/notifications")}
                >
                  View all
                </Link>
              </div>
              {recentNotifications.length ? (
                <div className="sb-topbar-notification-menu__list">
                  {recentNotifications.slice(0, 5).map((notification) => (
                    <Link
                      key={notification.id}
                      className={`sb-topbar-notification-menu__item focus-ring${notification.readAt ? "" : " is-unread"}`}
                      to={notification.href}
                      onClick={() => {
                        markNavigationStart(notification.href);
                        setNotificationsOpen(false);
                      }}
                    >
                      <strong>{notification.title}</strong>
                      <span>{notification.body}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="sb-topbar-notification-menu__empty">No notifications yet.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

import { Link, useNavigate } from "react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BellIcon, SearchIcon } from "../ui";
import {
  notificationWebSocketUrl,
  readNotificationSnapshot,
  reconnectDelay,
  type NotificationPreview,
} from "../../data/notifications-realtime";
import { ThemeControl } from "./ThemeControl";

function notificationLabel(type: string): string {
  return type.replaceAll(".", " ").replaceAll("_", " ");
}

function notificationHref(notification: NotificationPreview): string {
  if (notification.entityType === "POST" && notification.entityId)
    return `/posts/${encodeURIComponent(notification.entityId)}`;
  if (notification.entityType === "COMMENT" && notification.payloadJson) {
    try {
      const payload = JSON.parse(notification.payloadJson) as { postId?: unknown };
      if (typeof payload.postId === "string") return `/posts/${encodeURIComponent(payload.postId)}`;
    } catch {
      // Fall back to the complete notification page for malformed payloads.
    }
  }
  if (notification.entityType === "FRIENDSHIP") return "/friends";
  if (notification.entityType === "ACHIEVEMENT") return "/notifications";
  return "/notifications";
}

export function TopBar() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<NotificationPreview[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const query = searchTerm.trim();
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }
  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let attempts = 0;

    async function refresh(): Promise<{ authenticated: boolean; lastSeen: string | null }> {
      try {
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
      <Link className="sb-brand focus-ring" to="/" aria-label="SourceBoard">
        <span className="sb-brand__mark" aria-hidden="true">
          S
        </span>
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
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
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
                <Link className="sb-topbar-notification-menu__all focus-ring" to="/notifications">
                  View all
                </Link>
              </div>
              {recentNotifications.length ? (
                <div className="sb-topbar-notification-menu__list">
                  {recentNotifications.slice(0, 5).map((notification) => (
                    <Link
                      key={notification.id}
                      className={`sb-topbar-notification-menu__item focus-ring${notification.readAt ? "" : " is-unread"}`}
                      to={notificationHref(notification)}
                      onClick={() => setNotificationsOpen(false)}
                    >
                      <strong>{notificationLabel(notification.type)}</strong>
                      <span>
                        {notification.entityType
                          ? `${notification.entityType} ${notification.entityId ?? ""}`
                          : "SourceBoard activity"}
                      </span>
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

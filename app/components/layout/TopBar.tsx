import { Link, useNavigate, useRouteLoaderData } from "react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BellIcon, SearchIcon } from "../ui";
import { NotificationCard } from "../product/NotificationCard";
import type { NotificationCardView } from "../../../worker/notifications/grouping";
import {
  notificationWebSocketUrl,
  readNotificationSnapshot,
  reconnectDelay,
} from "../../data/notifications-realtime";
import { markNavigationStart } from "../../data/performance-metrics";
import { readCsrfToken } from "../../data/csrf";
import { useI18n } from "../../i18n/I18nProvider";
import { ThemeControl } from "./ThemeControl";
import type { RootLoaderData } from "../../root";

export function TopBar() {
  const navigate = useNavigate();
  const rootData = useRouteLoaderData<RootLoaderData>("root");
  const sessionUserId = rootData?.session?.user.id ?? null;
  const { t, tp } = useI18n();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<NotificationCardView[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
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

    if (!sessionUserId) {
      setNotificationsLoading(false);
      setUnreadCount(0);
      setRecentNotifications([]);
      return () => {
        disposed = true;
      };
    }

    async function refresh(): Promise<string | null> {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        if (response.status === 401 || response.status === 403) {
          if (!disposed) setNotificationsLoading(false);
          return null;
        }
        if (!response.ok) {
          if (!disposed) setNotificationsLoading(false);
          return null;
        }
        const snapshot = readNotificationSnapshot(await response.json());
        if (!disposed) {
          if (snapshot) {
            setUnreadCount(snapshot.unreadCount);
            setRecentNotifications(snapshot.notifications);
          }
          setNotificationsLoading(false);
        }
        return snapshot?.lastSeen ?? null;
      } catch {
        if (!disposed) setNotificationsLoading(false);
        return null;
      }
    }

    async function connect(): Promise<void> {
      const lastSeen = await refresh();
      if (disposed || typeof WebSocket === "undefined") return;
      socket = new WebSocket(notificationWebSocketUrl(window.location, lastSeen));
      socket.onopen = () => {
        attempts = 0;
      };
      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        try {
          const message = JSON.parse(event.data) as { type?: unknown };
          if (message.type === "ready" || message.type === "notification") void refresh();
        } catch {
          // D1 remains authoritative; malformed realtime frames are ignored.
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
  }, [sessionUserId]);

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

  async function markCardRead(notification: NotificationCardView): Promise<void> {
    if (!notification.unread) return;
    const response = await fetch("/api/notifications/read-batch", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": readCsrfToken(),
      },
      body: JSON.stringify({ notificationIds: notification.notificationIds }),
    }).catch(() => null);
    if (!response?.ok) return;
    const payload = (await response.json().catch(() => null)) as { unreadCount?: unknown } | null;
    setRecentNotifications((items) =>
      items.map((item) => (item.key === notification.key ? { ...item, unread: false } : item)),
    );
    if (typeof payload?.unreadCount === "number") setUnreadCount(payload.unreadCount);
  }

  async function markAllRead(): Promise<void> {
    if (!unreadCount) return;
    const response = await fetch("/api/notifications/read-all", {
      method: "POST",
      headers: { "x-csrf-token": readCsrfToken() },
    }).catch(() => null);
    if (!response?.ok) return;
    setUnreadCount(0);
    setRecentNotifications((items) => items.map((item) => ({ ...item, unread: false })));
  }

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
          src="/sourceboard-brand-mark.png"
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
        aria-label={t("search.label")}
        action="/search"
        method="get"
      >
        <span className="sr-only">{t("search.label")}</span>
        <SearchIcon width="18" height="18" />
        <input
          type="search"
          name="q"
          defaultValue=""
          placeholder={t("search.label")}
          aria-label={t("search.label")}
        />
      </form>

      <div className="sb-topbar-actions">
        <ThemeControl />
        <div className="sb-topbar-notification" ref={notificationMenuRef}>
          <button
            type="button"
            aria-label={t("nav.notifications")}
            aria-expanded={notificationsOpen}
            aria-controls="sourceboard-notification-menu"
            className="sb-topbar-notification-link sb-topbar-notification-trigger focus-ring"
            onClick={() => setNotificationsOpen((open) => !open)}
          >
            <BellIcon width="18" height="18" />
            {unreadCount ? (
              <span
                className="sb-topbar-notification-count"
                aria-label={tp("notifications.unreadCount", unreadCount)}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>
          {notificationsOpen ? (
            <div
              id="sourceboard-notification-menu"
              className="sb-topbar-notification-menu"
              role="dialog"
              aria-label={t("notifications.title")}
            >
              <div className="sb-topbar-notification-menu__header">
                <div>
                  <strong>{t("notifications.title")}</strong>
                  <span>
                    {unreadCount
                      ? tp("notifications.unreadCount", unreadCount)
                      : t("notifications.caughtUpTitle")}
                  </span>
                </div>
                <div className="sb-topbar-notification-menu__header-actions">
                  {unreadCount ? (
                    <button type="button" onClick={() => void markAllRead()}>
                      {t("notifications.markRead")}
                    </button>
                  ) : null}
                  <Link
                    className="sb-topbar-notification-menu__all focus-ring"
                    to="/notifications"
                    onClick={() => {
                      markNavigationStart("/notifications");
                      setNotificationsOpen(false);
                    }}
                  >
                    {t("notifications.viewAll")}
                  </Link>
                </div>
              </div>
              {notificationsLoading ? (
                <div className="sb-topbar-notification-menu__empty" role="status">
                  <strong>{t("notifications.loadingTitle")}</strong>
                  <span>{t("notifications.loadingDescription")}</span>
                </div>
              ) : recentNotifications.length ? (
                <div className="sb-topbar-notification-menu__list">
                  {recentNotifications.slice(0, 8).map((notification) => (
                    <NotificationCard
                      key={notification.key}
                      card={notification}
                      compact
                      onOpen={(card) => {
                        markNavigationStart(card.href);
                        void markCardRead(card);
                        setNotificationsOpen(false);
                      }}
                      onMarkRead={(card) => void markCardRead(card)}
                    />
                  ))}
                </div>
              ) : (
                <div className="sb-topbar-notification-menu__empty">
                  <strong>{t("notifications.caughtUpTitle")}</strong>
                  <span>{t("notifications.caughtUpDescription")}</span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

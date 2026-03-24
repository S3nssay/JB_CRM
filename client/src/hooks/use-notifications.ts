import { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial data
  useEffect(() => {
    async function fetchInitial() {
      try {
        const [notifs, countData] = await Promise.all([
          fetch("/api/crm/notifications", { credentials: "include" }).then((r) =>
            r.ok ? r.json() : []
          ),
          fetch("/api/crm/notifications/unread-count", { credentials: "include" }).then((r) =>
            r.ok ? r.json() : { count: 0 }
          ),
        ]);
        setNotifications(notifs);
        setUnreadCount(countData.count ?? 0);
      } catch {
        // Silently fail - notifications are non-critical
      }
    }
    fetchInitial();
  }, []);

  // SSE connection
  useEffect(() => {
    const es = new EventSource("/api/crm/notifications/stream", {
      withCredentials: true,
    });

    es.onmessage = (event) => {
      try {
        const notification: Notification = JSON.parse(event.data);
        setNotifications((prev) => [notification, ...prev]);
        setUnreadCount((prev) => prev + 1);
      } catch {
        // Ignore parse errors (heartbeats, etc.)
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; just log
      console.warn("Notification SSE connection error - will auto-reconnect");
    };

    eventSourceRef.current = es;

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  const markAsRead = useCallback(async (id: number) => {
    try {
      await apiRequest(`/api/crm/notifications/${id}/read`, "POST");
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiRequest("/api/crm/notifications/read-all", "POST");
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }, []);

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}

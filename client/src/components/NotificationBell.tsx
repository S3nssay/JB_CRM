import { useNotifications, type Notification } from "@/hooks/use-notifications";
import { useLocation } from "wouter";
import { Bell, CheckCheck, MessageSquare, AlertTriangle, Bot, Cog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const TYPE_ICONS: Record<string, any> = {
  step_completed: CheckCheck,
  step_failed: AlertTriangle,
  agent_action: Bot,
  escalation: AlertTriangle,
  message: MessageSquare,
};

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [, setLocation] = useLocation();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const displayNotifications = notifications.slice(0, 10);

  const handleClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.linkUrl) {
      setLocation(notification.linkUrl);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-[#791E75]" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[360px]">
          {displayNotifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No notifications</p>
            </div>
          ) : (
            <div>
              {displayNotifications.map((n, idx) => {
                const Icon = TYPE_ICONS[n.type] || Cog;
                return (
                  <div key={n.id}>
                    <button
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                        !n.isRead ? "bg-purple-50/50" : ""
                      }`}
                      onClick={() => handleClick(n)}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!n.isRead ? "font-medium text-gray-900" : "text-gray-700"}`}>
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">{relativeTime(n.createdAt)}</p>
                        </div>
                        {!n.isRead && (
                          <div className="h-2 w-2 rounded-full bg-[#791E75] mt-1.5 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                    {idx < displayNotifications.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 10 && (
          <div className="border-t px-4 py-2 text-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-[#791E75]"
              onClick={() => setLocation("/crm/notifications")}
            >
              View all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

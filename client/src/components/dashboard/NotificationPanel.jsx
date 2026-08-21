import {
  Bell,
  BellRing,
  CheckCheck,
  ChevronRight,
  Megaphone,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../services/notificationService";

const iconForType = (type) => {
  if (type === "announcement") return Megaphone;
  if (type === "community") return Users;
  if (type === "reward") return Trophy;
  return Sparkles;
};

const toneForType = (type) => {
  if (type === "announcement") return "bg-violet-50 text-violet-600";
  if (type === "community") return "bg-cyan-50 text-cyan-700";
  if (type === "reward") return "bg-emerald-50 text-emerald-700";
  return "bg-amber-50 text-amber-700";
};

const relativeTime = (value) => {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  const seconds = Math.max(Math.floor((Date.now() - time) / 1000), 0);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

function NotificationPanel({ onNavigate }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setLoading(true);
      const response = await getNotifications({ limit: 24 });
      setItems(response?.data?.notifications || []);
      setUnreadCount(Number(response?.data?.unreadCount || 0));
      setError("");
    } catch (requestError) {
      if (!quiet) {
        setError(requestError?.response?.data?.message || "Notifications are temporarily unavailable.");
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load({ quiet: true });

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") load({ quiet: true });
    };
    const timer = window.setInterval(refreshIfVisible, 60_000);
    const handleFocus = () => refreshIfVisible();
    const handleVisibility = () => refreshIfVisible();

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [load]);

  useEffect(() => {
    if (open) load();
  }, [load, open]);

  useEffect(() => {
    const close = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const openNotification = async (item) => {
    if (!item.readAt) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
      setUnreadCount((count) => Math.max(count - 1, 0));
      markNotificationRead(item.id).catch(() => load({ quiet: true }));
    }
    if (item.actionUrl) {
      setOpen(false);
      onNavigate(item.actionUrl);
    }
  };

  const markAll = async () => {
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      load({ quiet: true });
    }
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/84 bg-white/92 text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition hover:bg-white"
        aria-label="Notifications"
        aria-expanded={open}
      >
        {unreadCount > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-violet-600 px-1 text-[9px] font-black text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(92vw,390px)] rounded-[24px] bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400 p-[1.5px] shadow-[0_28px_70px_rgba(15,23,42,0.22)]">
          <div className="overflow-hidden rounded-[22.5px] bg-white/98 backdrop-blur-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-violet-50/80 via-white to-cyan-50/70 px-4 py-3.5">
              <div>
                <p className="text-sm font-black text-slate-900">Notifications</p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You are all caught up"}</p>
              </div>
              {unreadCount > 0 && <button type="button" onClick={markAll} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-black text-violet-600 transition hover:bg-violet-50"><CheckCheck size={14} /> Mark all read</button>}
            </div>

            <div className="sf-scrollbar max-h-[480px] overflow-y-auto p-2">
              {loading && !items.length ? (
                <div className="py-10 text-center text-sm font-semibold text-slate-400">Loading notifications...</div>
              ) : error && !items.length ? (
                <div className="m-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-5 text-sm font-semibold text-rose-700"><p>{error}</p><button type="button" onClick={() => load()} className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-black text-rose-700 shadow-sm">Retry</button></div>
              ) : items.length ? (
                items.map((item) => {
                  const Icon = iconForType(item.type);
                  const unread = !item.readAt;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openNotification(item)}
                      className={`relative flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${unread ? "border-violet-100 bg-violet-50/55 hover:bg-violet-50" : "border-transparent hover:border-slate-100 hover:bg-slate-50"}`}
                    >
                      {unread && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-violet-500" />}
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toneForType(item.type)}`}><Icon size={16} /></span>
                      <span className="min-w-0 flex-1 pr-3">
                        <span className="block text-xs font-black text-slate-900">{item.title}</span>
                        <span className="mt-1 line-clamp-3 block text-[11px] leading-5 text-slate-500">{item.body}</span>
                        <span className="mt-1.5 block text-[10px] font-bold text-slate-400">{relativeTime(item.createdAt)}</span>
                      </span>
                      {item.actionUrl && <ChevronRight size={15} className="mt-6 shrink-0 text-slate-300" />}
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-12 text-center">
                  <Bell size={24} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm font-black text-slate-700">No notifications yet</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">Announcements, community updates and rewards will appear here.</p>
                </div>
              )}
            </div>

            <button type="button" onClick={() => { setOpen(false); onNavigate("/settings"); }} className="flex w-full items-center justify-between border-t border-slate-100 bg-slate-50/65 px-4 py-3 text-xs font-black text-slate-600 transition hover:text-violet-600"><span>Notification & email preferences</span><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationPanel;

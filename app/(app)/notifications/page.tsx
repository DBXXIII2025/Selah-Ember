import { Bell, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notifications";

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function NotificationsPage() {
  const notifications = await getNotifications();
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <section className="px-6 py-12 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b94f22]">
              Notifications
            </p>
            <h1 className="mt-3 text-4xl font-semibold">Updates for you</h1>
            <p className="mt-4 max-w-2xl leading-7 text-[#67564c]">
              Lightweight updates from communities, groups, events, and prayer activity.
            </p>
          </div>
          {unreadCount > 0 ? (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#2f2722]/20 bg-white/70 px-5 py-3 text-sm font-semibold text-[#2f2722] transition hover:bg-white"
              >
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                Mark all read
              </button>
            </form>
          ) : null}
        </div>

        {notifications.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-[#d79568] bg-white/65 p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ffe2cb] text-[#b94f22]">
              <Bell aria-hidden="true" className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold">No notifications yet</h2>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-[#67564c]">
              Community joins, group joins, event RSVPs, and community prayer updates will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-10 space-y-4">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={`rounded-2xl border p-5 shadow-sm ${
                  notification.read_at
                    ? "border-[#ead6c5] bg-white/65"
                    : "border-[#d79568] bg-[#fff4e8]"
                }`}
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-semibold">{notification.title}</h2>
                      {!notification.read_at ? (
                        <span className="rounded-full bg-[#cf5f2b] px-3 py-1 text-xs font-semibold text-white">
                          Unread
                        </span>
                      ) : null}
                    </div>
                    {notification.body ? (
                      <p className="mt-2 leading-7 text-[#67564c]">{notification.body}</p>
                    ) : null}
                    <p className="mt-2 text-sm text-[#8a3f1e]">
                      {formatNotificationDate(notification.created_at)}
                    </p>
                    {notification.href ? (
                      <Link
                        href={notification.href}
                        className="mt-4 inline-flex items-center rounded-full border border-[#2f2722]/20 px-4 py-2 text-sm font-semibold text-[#2f2722] transition hover:bg-white"
                      >
                        Open
                      </Link>
                    ) : null}
                  </div>
                  {!notification.read_at ? (
                    <form action={markNotificationRead}>
                      <input type="hidden" name="notification_id" value={notification.id} />
                      <button
                        type="submit"
                        className="rounded-full bg-[#cf5f2b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b94f22]"
                      >
                        Mark read
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

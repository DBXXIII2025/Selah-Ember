import { Bell, CheckCircle2 } from "lucide-react";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notifications";
import { ActionButton, Badge, ContentCard, EmptyState, PageContainer, PageHeader } from "@/components/ui/app-ui";

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
    <PageContainer size="medium">
      <PageHeader
        eyebrow="Notifications"
        title="Updates for you"
        description="Lightweight updates from the community, groups, events, and prayer activity."
        action={unreadCount > 0 ? (
            <form action={markAllNotificationsRead}>
              <ActionButton type="submit" variant="secondary">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                Mark all read
              </ActionButton>
            </form>
          ) : null}
      />

      {notifications.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={Bell}
          title="No notifications yet"
          description="Group joins, event RSVPs, and community prayer updates will appear here."
        />
        ) : (
          <div className="mt-10 space-y-4">
            {notifications.map((notification) => (
              <ContentCard
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
                        <Badge tone="solid">Unread</Badge>
                      ) : null}
                    </div>
                    {notification.body ? (
                      <p className="mt-2 leading-7 text-[#67564c]">{notification.body}</p>
                    ) : null}
                    <p className="mt-2 text-sm text-[#8a3f1e]">
                      {formatNotificationDate(notification.created_at)}
                    </p>
                    {notification.href ? (
                      <ActionButton href={notification.href} variant="secondary" size="sm" className="mt-4">Open</ActionButton>
                    ) : null}
                  </div>
                  {!notification.read_at ? (
                    <form action={markNotificationRead}>
                      <input type="hidden" name="notification_id" value={notification.id} />
                      <ActionButton type="submit" size="sm">Mark read</ActionButton>
                    </form>
                  ) : null}
                </div>
              </ContentCard>
            ))}
          </div>
        )}
    </PageContainer>
  );
}

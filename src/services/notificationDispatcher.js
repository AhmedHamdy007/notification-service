const {
  countUnreadNotifications,
  createNotification,
} = require("../repositories/notificationRepository");

async function createAndDispatchNotification(payload, { hub } = {}) {
  const notification = await createNotification(payload);
  const userId = notification?.recipient?.userId;

  if (userId && hub) {
    const unreadCount = await countUnreadNotifications(userId);
    hub.emitToUser(userId, "notification", {
      notification,
      unreadCount,
    }, { id: notification.id });
  }

  return notification;
}

module.exports = {
  createAndDispatchNotification,
};

const mongoose = require("mongoose");
const Notification = require("../models/Notification");

const MAX_LIST_LIMIT = 100;

function clampLimit(value, defaultValue = 30) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, 1), MAX_LIST_LIMIT);
}

function serialize(notification) {
  if (!notification) return null;
  return typeof notification.toJSON === "function" ? notification.toJSON() : notification;
}

async function listNotificationsForUser(userId, options = {}) {
  const query = {
    "recipient.userId": String(userId),
    archivedAt: null,
  };

  if (options.unreadOnly) {
    query.readAt = null;
  }

  if (options.before) {
    const before = new Date(options.before);
    if (!Number.isNaN(before.getTime())) {
      query.createdAt = { $lt: before };
    }
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(clampLimit(options.limit, options.defaultLimit || 30));

  return notifications.map(serialize);
}

async function countUnreadNotifications(userId) {
  return Notification.countDocuments({
    "recipient.userId": String(userId),
    readAt: null,
    archivedAt: null,
  });
}

async function createNotification(payload) {
  try {
    const notification = await Notification.create(payload);
    return serialize(notification);
  } catch (error) {
    if (error.code === 11000 && payload?.source?.eventId) {
      const existing = await Notification.findOne({
        "source.eventId": payload.source.eventId,
      });
      return serialize(existing);
    }
    throw error;
  }
}

async function markNotificationRead(userId, notificationId) {
  if (!mongoose.isValidObjectId(notificationId)) return null;
  const notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      "recipient.userId": String(userId),
      archivedAt: null,
    },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  return serialize(notification);
}

async function markAllNotificationsRead(userId) {
  const now = new Date();
  const result = await Notification.updateMany(
    {
      "recipient.userId": String(userId),
      readAt: null,
      archivedAt: null,
    },
    { $set: { readAt: now } }
  );
  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    readAt: now.toISOString(),
  };
}

module.exports = {
  clampLimit,
  countUnreadNotifications,
  createNotification,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
};

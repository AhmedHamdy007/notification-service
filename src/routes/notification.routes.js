const express = require("express");
const config = require("../config");
const { healthCheck } = require("../db/mongoose");
const { authenticateToken } = require("../middleware/auth");
const {
  clampLimit,
  countUnreadNotifications,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} = require("../repositories/notificationRepository");
const { dispatchEvent } = require("../events/subscriptions");

const router = express.Router();

function currentUserId(req) {
  return req.user?.id || req.auth?.sub;
}

function requireInternalEventAccess(req, res, next) {
  if (config.internalEventToken) {
    const supplied = req.get("x-internal-event-token") || "";
    if (supplied !== config.internalEventToken) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        request_id: req.id,
      });
    }
  }

  if (config.nodeEnv === "production" && !config.internalEventToken) {
    return res.status(403).json({
      success: false,
      error: "Internal event token is required",
      request_id: req.id,
    });
  }

  return next();
}

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "notification-service",
    timestamp: new Date().toISOString(),
  });
});

router.get("/ready", async (req, res) => {
  try {
    await healthCheck();
    return res.json({
      ready: true,
      service: "notification-service",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(503).json({
      ready: false,
      service: "notification-service",
      error: "Database unavailable",
      request_id: req.id,
    });
  }
});

router.post("/internal/events", requireInternalEventAccess, async (req, res) => {
  const eventType = req.body?.type || req.body?.eventType;
  if (!eventType) {
    return res.status(400).json({
      success: false,
      error: "Event type is required",
      request_id: req.id,
    });
  }

  const notification = await dispatchEvent(eventType, req.body?.payload || {}, {
    hub: req.app.locals.sseHub,
  });

  return res.status(202).json({
    success: true,
    handled: Boolean(notification),
    data: notification,
    request_id: req.id,
  });
});

router.get("/notifications", authenticateToken, async (req, res) => {
  const userId = currentUserId(req);
  const limit = clampLimit(req.query.limit, config.notificationHistoryLimit);
  const notifications = await listNotificationsForUser(userId, {
    limit,
    before: req.query.before,
    unreadOnly: req.query.unreadOnly === "true",
  });
  const unreadCount = await countUnreadNotifications(userId);

  return res.json({
    success: true,
    count: notifications.length,
    unreadCount,
    data: notifications,
    request_id: req.id,
  });
});

router.get("/notifications/unread-count", authenticateToken, async (req, res) => {
  const count = await countUnreadNotifications(currentUserId(req));
  return res.json({
    success: true,
    data: { count },
    request_id: req.id,
  });
});

router.get("/notifications/stream", authenticateToken, async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const unreadCount = await countUnreadNotifications(userId);
    const client = req.app.locals.sseHub.register(req, res, { id: userId });
    client.send("unread_count", { count: unreadCount });
  } catch (error) {
    if (!res.headersSent) return next(error);
    req.logger?.error("Notification SSE stream failed", {
      request_id: req.id,
      error: error.message,
    });
    return res.end();
  }
});

router.patch("/notifications/read-all", authenticateToken, async (req, res) => {
  const result = await markAllNotificationsRead(currentUserId(req));
  return res.json({
    success: true,
    data: result,
    request_id: req.id,
  });
});

router.patch("/notifications/:notificationId/read", authenticateToken, async (req, res) => {
  const notification = await markNotificationRead(currentUserId(req), req.params.notificationId);
  if (!notification) {
    return res.status(404).json({
      success: false,
      error: "Notification not found",
      request_id: req.id,
    });
  }

  return res.json({
    success: true,
    data: notification,
    request_id: req.id,
  });
});

module.exports = router;

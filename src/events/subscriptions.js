const { subscribe } = require("./subscriber");
const {
  BOOKING_CONFIRMED,
  BOOKING_CANCELLED,
  BOOKING_COMPLETED,
  MESSAGING_MESSAGE_SENT,
} = require("./eventTypes");
const { createAndDispatchNotification } = require("../services/notificationDispatcher");

function notificationSource(eventType, eventId) {
  return {
    service: "event-bus",
    eventType,
    eventId,
  };
}

async function sendBookingConfirmed(payload, { hub } = {}) {
  return createAndDispatchNotification(
    {
      recipient: { userId: payload.userId, role: "customer" },
      type: BOOKING_CONFIRMED,
      title: "Booking confirmed",
      body: "Your booking has been confirmed.",
      data: payload,
      actionUrl: `/bookings/${payload.bookingId}`,
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(BOOKING_CONFIRMED, `${BOOKING_CONFIRMED}:${payload.bookingId}`),
      priority: "normal",
    },
    { hub }
  );
}

async function sendBookingCancelled(payload, { hub } = {}) {
  return createAndDispatchNotification(
    {
      recipient: { userId: payload.userId, role: "customer" },
      type: BOOKING_CANCELLED,
      title: "Booking cancelled",
      body: payload.reason ? `Your booking was cancelled: ${payload.reason}` : "Your booking was cancelled.",
      data: payload,
      actionUrl: `/bookings/${payload.bookingId}`,
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(BOOKING_CANCELLED, `${BOOKING_CANCELLED}:${payload.bookingId}`),
      priority: "high",
    },
    { hub }
  );
}

async function sendReviewRequest(payload, { hub } = {}) {
  return createAndDispatchNotification(
    {
      recipient: { userId: payload.userId, role: "customer" },
      type: BOOKING_COMPLETED,
      title: "How was your visit?",
      body: "Your appointment is complete. Share a quick review when you have a moment.",
      data: payload,
      actionUrl: `/bookings/${payload.bookingId}`,
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(BOOKING_COMPLETED, `${BOOKING_COMPLETED}:${payload.bookingId}`),
      priority: "normal",
    },
    { hub }
  );
}

async function sendMessageAlert(payload, { hub } = {}) {
  return createAndDispatchNotification(
    {
      recipient: { userId: payload.recipientId, role: payload.recipientRole || "customer" },
      actor: { userId: payload.senderId },
      type: MESSAGING_MESSAGE_SENT,
      title: "New message",
      body: "You have a new message.",
      data: payload,
      actionUrl: `/messages/${payload.conversationId}`,
      entity: { type: "conversation", id: payload.conversationId },
      source: notificationSource(MESSAGING_MESSAGE_SENT, `${MESSAGING_MESSAGE_SENT}:${payload.messageId}`),
      priority: "normal",
    },
    { hub }
  );
}

async function initSubscriptions({ hub } = {}) {
  if (!process.env.RABBITMQ_URL) {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "event-subscriber",
      level: "WARN",
      message: "RABBITMQ_URL missing; notification subscriptions disabled",
    }));
    return;
  }

  await subscribe(BOOKING_CONFIRMED, "notification-service.bookings.confirmed", async (payload, ack, nack) => {
    try {
      await sendBookingConfirmed(payload, { hub });
      ack();
    } catch (error) {
      nack(error);
    }
  });

  await subscribe(BOOKING_CANCELLED, "notification-service.bookings.cancelled", async (payload, ack, nack) => {
    try {
      await sendBookingCancelled(payload, { hub });
      ack();
    } catch (error) {
      nack(error);
    }
  });

  await subscribe(BOOKING_COMPLETED, "notification-service.bookings.completed", async (payload, ack, nack) => {
    try {
      await sendReviewRequest(payload, { hub });
      ack();
    } catch (error) {
      nack(error);
    }
  });

  await subscribe(MESSAGING_MESSAGE_SENT, "notification-service.messages", async (payload, ack, nack) => {
    try {
      await sendMessageAlert(payload, { hub });
      ack();
    } catch (error) {
      nack(error);
    }
  });
}

module.exports = { initSubscriptions };

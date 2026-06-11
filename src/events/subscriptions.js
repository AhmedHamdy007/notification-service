const { subscribe } = require("./subscriber");
const {
  BOOKING_ACCEPTED,
  BOOKING_CONFIRMED,
  BOOKING_CANCELLED,
  BOOKING_COMPLETED,
  BOOKING_DEPOSIT_PAID,
  BOOKING_DISPUTED,
  BOOKING_REJECTED,
  BOOKING_PAYMENT_FAILED,
  DISPUTE_RESOLVED,
  PAYMENT_AUTHORIZATION_EXPIRING,
  PAYMENT_CAPTURED,
  PAYMENT_FAILED,
  STYLIST_BOOKING_CONFIRMED,
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
      body: "Appointment confirmed. Your card has been reserved but not charged yet.",
      data: payload,
      actionUrl: `/bookings/${payload.bookingId}`,
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(BOOKING_CONFIRMED, `${BOOKING_CONFIRMED}:${payload.bookingId}`),
      priority: "normal",
    },
    { hub }
  );
}

async function sendBookingAccepted(payload, { hub } = {}) {
  return createAndDispatchNotification(
    {
      recipient: { userId: payload.userId, role: "customer" },
      type: BOOKING_ACCEPTED,
      title: "Booking accepted",
      body: "Your booking was accepted. Please authorize payment to secure your appointment.",
      data: payload,
      actionUrl: `/bookings/${payload.bookingId}`,
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(BOOKING_ACCEPTED, `${BOOKING_ACCEPTED}:${payload.bookingId}`),
      priority: "high",
    },
    { hub }
  );
}

async function sendBookingRejected(payload, { hub } = {}) {
  return createAndDispatchNotification(
    {
      recipient: { userId: payload.userId, role: "customer" },
      type: BOOKING_REJECTED,
      title: "Booking declined",
      body: payload.reason ? `Your booking was declined: ${payload.reason}` : "Your booking was declined.",
      data: payload,
      actionUrl: `/bookings/${payload.bookingId}`,
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(BOOKING_REJECTED, `${BOOKING_REJECTED}:${payload.bookingId}`),
      priority: "high",
    },
    { hub }
  );
}

async function sendStylistBookingConfirmed(payload, { hub } = {}) {
  return createAndDispatchNotification(
    {
      recipient: { userId: payload.stylistId || payload.userId, role: "stylist" },
      type: STYLIST_BOOKING_CONFIRMED,
      title: "New paid booking",
      body: "Appointment confirmed. The customer's card is reserved.",
      data: payload,
      actionUrl: `/dashboard/stylist/bookings`,
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(
        STYLIST_BOOKING_CONFIRMED,
        `${STYLIST_BOOKING_CONFIRMED}:${payload.bookingId}`
      ),
      priority: "normal",
    },
    { hub }
  );
}

async function sendPaymentCaptured(payload, { hub } = {}) {
  await createAndDispatchNotification(
    {
      recipient: { userId: payload.userId || payload.customerId, role: "customer" },
      type: PAYMENT_CAPTURED,
      title: "Payment received",
      body: "Thank you. Your receipt is ready.",
      data: payload,
      actionUrl: `/bookings/${payload.bookingId}`,
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(PAYMENT_CAPTURED, `${PAYMENT_CAPTURED}:customer:${payload.bookingId}`),
      priority: "normal",
    },
    { hub }
  );

  return createAndDispatchNotification(
    {
      recipient: { userId: payload.stylistId, role: "stylist" },
      type: PAYMENT_CAPTURED,
      title: "Payment received",
      body: "Payment received, payout is on the way.",
      data: payload,
      actionUrl: "/dashboard/stylist/bookings",
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(PAYMENT_CAPTURED, `${PAYMENT_CAPTURED}:stylist:${payload.bookingId}`),
      priority: "normal",
    },
    { hub }
  );
}

/**
 * Notify the customer and stylist once Stripe verifies a required booking deposit.
 */
async function sendDepositPaid(payload, { hub } = {}) {
  await createAndDispatchNotification(
    {
      recipient: { userId: payload.userId || payload.customerId, role: "customer" },
      type: BOOKING_DEPOSIT_PAID,
      title: "Deposit paid",
      body: "Your deposit was received. Your appointment is confirmed.",
      data: payload,
      actionUrl: `/bookings/${payload.bookingId}`,
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(BOOKING_DEPOSIT_PAID, `${BOOKING_DEPOSIT_PAID}:customer:${payload.bookingId}`),
      priority: "normal",
    },
    { hub }
  );

  if (!payload.stylistId) return null;
  return createAndDispatchNotification(
    {
      recipient: { userId: payload.stylistId, role: "stylist" },
      type: BOOKING_DEPOSIT_PAID,
      title: "Deposit paid",
      body: "A customer paid the required deposit. The appointment is confirmed.",
      data: payload,
      actionUrl: "/dashboard/stylist/bookings",
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(BOOKING_DEPOSIT_PAID, `${BOOKING_DEPOSIT_PAID}:stylist:${payload.bookingId}`),
      priority: "normal",
    },
    { hub }
  );
}

async function sendPaymentFailed(payload, { hub } = {}) {
  const eventType = payload.type || BOOKING_PAYMENT_FAILED;
  return createAndDispatchNotification(
    {
      recipient: { userId: payload.userId, role: "customer" },
      type: eventType,
      title: "Payment failed",
      body: "Your booking payment did not go through.",
      data: payload,
      actionUrl: `/payment/${payload.bookingId}`,
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(eventType, `${eventType}:${payload.bookingId}`),
      priority: "high",
    },
    { hub }
  );
}

async function sendAuthorizationExpiring(payload, { hub } = {}) {
  return createAndDispatchNotification(
    {
      recipient: { userId: payload.userId || payload.customerId, role: "customer" },
      type: PAYMENT_AUTHORIZATION_EXPIRING,
      title: "Payment authorization expiring soon",
      body: "Your card reservation expires in about 24 hours. Please contact the salon if your appointment needs to move.",
      data: payload,
      actionUrl: `/bookings/${payload.bookingId}`,
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(PAYMENT_AUTHORIZATION_EXPIRING, `${PAYMENT_AUTHORIZATION_EXPIRING}:${payload.bookingId}`),
      priority: "high",
    },
    { hub }
  );
}

async function sendBookingCancelled(payload, { hub } = {}) {
  await createAndDispatchNotification(
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

  if (!payload.stylistId) return null;
  return createAndDispatchNotification(
    {
      recipient: { userId: payload.stylistId, role: "stylist" },
      type: BOOKING_CANCELLED,
      title: "Booking cancelled",
      body: payload.reason ? `Booking cancelled: ${payload.reason}` : "Booking cancelled.",
      data: payload,
      actionUrl: "/dashboard/stylist/bookings",
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(BOOKING_CANCELLED, `${BOOKING_CANCELLED}:stylist:${payload.bookingId}`),
      priority: "high",
    },
    { hub }
  );
}

async function sendBookingDisputed(payload, { hub } = {}) {
  await createAndDispatchNotification(
    {
      recipient: { userId: "admin", role: "admin" },
      type: BOOKING_DISPUTED,
      title: "New dispute raised",
      body: "A customer reported a problem with a completed booking.",
      data: payload,
      actionUrl: `/admin/disputes/${payload.disputeId}`,
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(BOOKING_DISPUTED, `${BOOKING_DISPUTED}:admin:${payload.disputeId}`),
      priority: "high",
    },
    { hub }
  );

  return createAndDispatchNotification(
    {
      recipient: { userId: payload.stylistId, role: "stylist" },
      type: BOOKING_DISPUTED,
      title: "Customer reported a problem",
      body: "A customer reported a problem after service. Our team is reviewing it.",
      data: payload,
      actionUrl: "/dashboard/stylist/bookings",
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(BOOKING_DISPUTED, `${BOOKING_DISPUTED}:stylist:${payload.disputeId}`),
      priority: "high",
    },
    { hub }
  );
}

async function sendDisputeResolved(payload, { hub } = {}) {
  const body = payload.resolution === "refund"
    ? "Your dispute was resolved with a refund."
    : "Your dispute was reviewed and closed without a refund.";

  await createAndDispatchNotification(
    {
      recipient: { userId: payload.userId || payload.customerId, role: "customer" },
      type: DISPUTE_RESOLVED,
      title: "Dispute resolved",
      body,
      data: payload,
      actionUrl: `/bookings/${payload.bookingId}`,
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(DISPUTE_RESOLVED, `${DISPUTE_RESOLVED}:customer:${payload.disputeId}`),
      priority: "high",
    },
    { hub }
  );

  return createAndDispatchNotification(
    {
      recipient: { userId: payload.stylistId, role: "stylist" },
      type: DISPUTE_RESOLVED,
      title: "Dispute resolved",
      body,
      data: payload,
      actionUrl: "/dashboard/stylist/bookings",
      entity: { type: "booking", id: payload.bookingId },
      source: notificationSource(DISPUTE_RESOLVED, `${DISPUTE_RESOLVED}:stylist:${payload.disputeId}`),
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

const subscriptionDefinitions = [
  {
    type: BOOKING_CONFIRMED,
    queue: "notification-service.bookings.confirmed",
    handler: sendBookingConfirmed,
  },
  {
    type: BOOKING_ACCEPTED,
    queue: "notification-service.bookings.accepted",
    handler: sendBookingAccepted,
  },
  {
    type: BOOKING_REJECTED,
    queue: "notification-service.bookings.rejected",
    handler: sendBookingRejected,
  },
  {
    type: STYLIST_BOOKING_CONFIRMED,
    queue: "notification-service.bookings.stylist-confirmed",
    handler: sendStylistBookingConfirmed,
  },
  {
    type: PAYMENT_CAPTURED,
    queue: "notification-service.payments.captured",
    handler: sendPaymentCaptured,
  },
  {
    type: BOOKING_DEPOSIT_PAID,
    queue: "notification-service.bookings.deposit-paid",
    handler: sendDepositPaid,
  },
  {
    type: BOOKING_PAYMENT_FAILED,
    queue: "notification-service.bookings.payment-failed",
    handler: sendPaymentFailed,
  },
  {
    type: PAYMENT_FAILED,
    queue: "notification-service.payments.failed",
    handler: (payload, options) => sendPaymentFailed({ ...payload, type: PAYMENT_FAILED }, options),
  },
  {
    type: PAYMENT_AUTHORIZATION_EXPIRING,
    queue: "notification-service.payments.authorization-expiring",
    handler: sendAuthorizationExpiring,
  },
  {
    type: BOOKING_CANCELLED,
    queue: "notification-service.bookings.cancelled",
    handler: sendBookingCancelled,
  },
  {
    type: BOOKING_DISPUTED,
    queue: "notification-service.bookings.disputed",
    handler: sendBookingDisputed,
  },
  {
    type: DISPUTE_RESOLVED,
    queue: "notification-service.bookings.dispute-resolved",
    handler: sendDisputeResolved,
  },
  {
    type: BOOKING_COMPLETED,
    queue: "notification-service.bookings.completed",
    handler: sendReviewRequest,
  },
  {
    type: MESSAGING_MESSAGE_SENT,
    queue: "notification-service.messages",
    handler: sendMessageAlert,
  },
];

async function dispatchEvent(eventType, payload, { hub } = {}) {
  const definition = subscriptionDefinitions.find((entry) => entry.type === eventType);
  if (!definition) return null;
  return definition.handler(payload || {}, { hub });
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

  for (const definition of subscriptionDefinitions) {
    await subscribe(definition.type, definition.queue, async (payload, ack, nack) => {
      try {
        await definition.handler(payload, { hub });
        ack();
      } catch (error) {
        nack(error);
      }
    });
  }
}

module.exports = { dispatchEvent, initSubscriptions };

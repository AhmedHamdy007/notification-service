const mongoose = require("mongoose");

const ROLES = ["owner", "stylist", "customer", "admin"];
const PRIORITIES = ["low", "normal", "high"];

const actorSchema = new mongoose.Schema(
  {
    userId: { type: String, trim: true },
    role: { type: String, enum: ROLES },
    name: { type: String, trim: true, maxlength: 140 },
    avatarUrl: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      userId: { type: String, required: true, trim: true, index: true },
      role: { type: String, required: true, enum: ROLES, index: true },
    },
    actor: actorSchema,
    type: { type: String, required: true, trim: true, maxlength: 80, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 500 },
    data: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    actionUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      validate: {
        validator(value) {
          return !value || value.startsWith("/") || /^https?:\/\//i.test(value);
        },
        message: "actionUrl must be an absolute http(s) URL or an app-relative path",
      },
    },
    entity: {
      type: { type: String, trim: true, maxlength: 80 },
      id: { type: String, trim: true, maxlength: 140 },
    },
    source: {
      service: { type: String, trim: true, maxlength: 80 },
      eventId: { type: String, trim: true, maxlength: 140 },
      eventType: { type: String, trim: true, maxlength: 120 },
    },
    priority: { type: String, enum: PRIORITIES, default: "normal", index: true },
    readAt: { type: Date, default: null, index: true },
    archivedAt: { type: Date, default: null, index: true },
    expiresAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  }
);

notificationSchema.index({ "recipient.userId": 1, createdAt: -1 });
notificationSchema.index({ "recipient.userId": 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ "source.eventId": 1 }, { unique: true, sparse: true });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model("Notification", notificationSchema);

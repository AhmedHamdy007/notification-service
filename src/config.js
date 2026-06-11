require("dotenv").config();

function env(name, defaultValue) {
  const value = process.env[name];
  if (value !== undefined && value !== "") return value;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`${name} is required`);
}

function intEnv(name, defaultValue) {
  const raw = env(name, defaultValue);
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) {
    throw new Error(`${name} must be an integer`);
  }
  return value;
}

function csvEnv(name) {
  const value = process.env[name];
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

module.exports = {
  port: intEnv("PORT", "4006"),
  nodeEnv: env("NODE_ENV", "development"),
  logLevel: env("LOG_LEVEL", "INFO"),
  mongoUri: env("MONGO_URI"),
  mongoDbName: process.env.MONGO_DB_NAME || undefined,
  authServiceUrl: env("AUTH_SERVICE_URL"),
  jwtPublicKeyPath: env("JWT_PUBLIC_KEY_PATH"),
  jwtIssuer: env("JWT_ISSUER"),
  jwtAudience: env("JWT_AUDIENCE"),
  corsAllowedOrigins: csvEnv("CORS_ALLOWED_ORIGINS"),
  sseHeartbeatMs: intEnv("SSE_HEARTBEAT_MS", "25000"),
  notificationHistoryLimit: intEnv("NOTIFICATION_HISTORY_LIMIT", "30"),
  internalEventToken: process.env.INTERNAL_EVENT_TOKEN || "",
};

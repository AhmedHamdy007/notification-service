require("express-async-errors");

const express = require("express");
const cors = require("cors");
const http = require("http");

const config = require("./config");
const {
  createCorsOptions,
  securityHeadersMiddleware,
} = require("../../shared/http/httpSecurity");
const { connectMongo, disconnectMongo } = require("./db/mongoose");
const { Logger } = require("./utils/logger");
const { SseHub } = require("./realtime/sseHub");
const requestContext = require("./middleware/requestContext");
const routes = require("./routes/notification.routes");
const errorHandler = require("./middleware/errorHandler");
const { initSubscriptions } = require("./events/subscriptions");

const app = express();
const server = http.createServer(app);
const logger = new Logger("notification-service", config.logLevel);
const sseHub = new SseHub({
  logger,
  heartbeatMs: config.sseHeartbeatMs,
});
const corsOptions = createCorsOptions({
  nodeEnv: config.nodeEnv,
  corsAllowedOrigins: config.corsAllowedOrigins,
  allowedMethods: ["GET", "PATCH", "POST", "OPTIONS"],
});

app.use(securityHeadersMiddleware);
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(requestContext(logger));
app.locals.sseHub = sseHub;
app.use(routes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    request_id: req.id,
  });
});

app.use(errorHandler);

async function start() {
  await connectMongo(logger);
  server.listen(config.port, async () => {
    logger.info("Notification service started", {
      port: config.port,
      nodeEnv: config.nodeEnv,
    });
    try {
      await initSubscriptions({ hub: sseHub });
      logger.info("Event subscriptions initialized");
    } catch (error) {
      logger.error("Failed to initialize event subscriptions", { error: error.message });
      process.exit(1);
    }
  });
}

async function shutdown(signal) {
  logger.info("Shutdown signal received", { signal });
  server.close(async () => {
    await disconnectMongo();
    process.exit(0);
  });
}

if (require.main === module) {
  start().catch((error) => {
    logger.error("Unable to start notification service", { error: error.message });
    process.exit(1);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = app;

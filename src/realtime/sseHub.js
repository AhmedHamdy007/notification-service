const crypto = require("crypto");

function writeSse(res, event, data, options = {}) {
  if (res.destroyed || res.writableEnded) return false;

  if (options.retry) {
    res.write(`retry: ${options.retry}\n`);
  }
  if (options.id) {
    res.write(`id: ${options.id}\n`);
  }
  if (event) {
    res.write(`event: ${event}\n`);
  }

  const payload = data === undefined ? "" : JSON.stringify(data);
  payload.split(/\r?\n/).forEach((line) => {
    res.write(`data: ${line}\n`);
  });
  res.write("\n");
  return true;
}

class SseHub {
  constructor({ logger, heartbeatMs = 25000 }) {
    this.logger = logger;
    this.heartbeatMs = heartbeatMs;
    this.connectionsByUserId = new Map();
  }

  register(req, res, user) {
    const userId = String(user.id);
    const connectionId = crypto.randomUUID();

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    res.socket?.setKeepAlive?.(true);

    const client = {
      id: connectionId,
      userId,
      res,
      send(event, data, options) {
        return writeSse(res, event, data, options);
      },
    };

    const connections = this.connectionsByUserId.get(userId) || new Map();
    connections.set(connectionId, client);
    this.connectionsByUserId.set(userId, connections);

    this.logger.info("Notification SSE client connected", {
      userId,
      connectionId,
      connectionCount: connections.size,
    });

    const heartbeat = setInterval(() => {
      if (!res.destroyed && !res.writableEnded) {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      }
    }, this.heartbeatMs);

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);

      const active = this.connectionsByUserId.get(userId);
      if (active) {
        active.delete(connectionId);
        if (active.size === 0) {
          this.connectionsByUserId.delete(userId);
        }
      }

      this.logger.info("Notification SSE client disconnected", {
        userId,
        connectionId,
        connectionCount: active?.size || 0,
      });
    };

    req.on("close", cleanup);
    res.on("close", cleanup);
    res.on("error", cleanup);

    client.send("ready", {
      userId,
      connectedAt: new Date().toISOString(),
    }, { retry: 5000 });

    return client;
  }

  emitToUser(userId, event, data, options = {}) {
    const connections = this.connectionsByUserId.get(String(userId));
    if (!connections?.size) return 0;

    let delivered = 0;
    for (const client of connections.values()) {
      if (client.send(event, data, options)) {
        delivered += 1;
      }
    }
    return delivered;
  }
}

module.exports = { SseHub };

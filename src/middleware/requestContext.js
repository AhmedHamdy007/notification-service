const crypto = require("crypto");

function requestContext(logger) {
  return (req, res, next) => {
    req.id = req.headers["x-request-id"] || crypto.randomUUID();
    req.logger = logger;
    res.setHeader("X-Request-Id", req.id);
    next();
  };
}

module.exports = requestContext;

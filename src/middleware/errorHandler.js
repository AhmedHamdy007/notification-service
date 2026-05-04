function errorHandler(err, req, res, next) {
  req.logger?.error("Notification request failed", {
    request_id: req.id,
    method: req.method,
    path: req.path,
    error: err.message,
  });

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: Object.values(err.errors || {}).map((entry) => entry.message),
      request_id: req.id,
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      error: "Invalid identifier",
      request_id: req.id,
    });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      request_id: req.id,
    });
  }

  return res.status(500).json({
    success: false,
    error: "Internal server error",
    request_id: req.id,
  });
}

module.exports = errorHandler;

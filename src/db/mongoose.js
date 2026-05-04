const mongoose = require("mongoose");
const config = require("../config");

let connectionPromise = null;

async function connectMongo(logger) {
  if (connectionPromise) return connectionPromise;

  mongoose.set("strictQuery", true);
  mongoose.connection.on("error", (error) => {
    logger?.error("MongoDB connection error", { error: error.message });
  });

  connectionPromise = mongoose
    .connect(config.mongoUri, {
      dbName: config.mongoDbName,
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
      autoIndex: config.nodeEnv !== "production",
    })
    .then((connection) => {
      logger?.info("MongoDB connected", {
        database: connection.connection.name,
      });
      return connection;
    })
    .catch((error) => {
      connectionPromise = null;
      throw error;
    });

  return connectionPromise;
}

async function healthCheck() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB is not connected");
  }
  await mongoose.connection.db.admin().ping();
}

async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = {
  connectMongo,
  disconnectMongo,
  healthCheck,
};

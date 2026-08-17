import "dotenv/config";

import { createServer } from "node:http";

import app from "./app.js";
import connectDB from "./config/db.js";
import { closeRedis, connectRedis } from "./config/redis.js";
import { initializeSocketServer } from "./realtime/socket.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  await connectRedis();

  const server = createServer(app);
  initializeSocketServer(server);

  server.listen(PORT, () => {
    console.log(`StudyFluxAI server running on port ${PORT}`);
  });

  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`${signal} received. Shutting down gracefully...`);

    server.close(async () => {
      await closeRedis();
      console.log("StudyFluxAI server stopped.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer().catch((error) => {
  console.error("Failed to start StudyFluxAI:", error);
  process.exit(1);
});

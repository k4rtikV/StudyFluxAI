import { Server } from "socket.io";

let io = null;

export const initializeSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("community:join-poll", (pollId) => {
      if (typeof pollId === "string" && pollId.length < 80) {
        socket.join(`poll:${pollId}`);
      }
    });

    socket.on("community:leave-poll", (pollId) => {
      if (typeof pollId === "string" && pollId.length < 80) {
        socket.leave(`poll:${pollId}`);
      }
    });

    socket.on("leaderboard:join", () => socket.join("leaderboard"));
    socket.on("leaderboard:leave", () => socket.leave("leaderboard"));
  });

  return io;
};

export const emitPollResults = (pollId, results) => {
  if (!io) return;
  io.to(`poll:${pollId}`).emit("community:poll-results", {
    pollId: String(pollId),
    results,
  });
};

export const emitLeaderboardChanged = (payload = {}) => {
  if (!io) return;
  io.to("leaderboard").emit("leaderboard:changed", {
    updatedAt: new Date().toISOString(),
    ...payload,
  });
};

import { Server } from "socket.io";

import { isAllowedClientOrigin } from "../config/env.js";
import StudySession from "../models/StudySession.js";
import User from "../models/User.js";
import { verifyAuthToken } from "../utils/jwt.js";

let io = null;

const readCookie = (header, name) => {
  const prefix = `${name}=`;
  for (const part of String(header || "").split(";")) {
    const value = part.trim();
    if (!value.startsWith(prefix)) continue;
    try {
      return decodeURIComponent(value.slice(prefix.length));
    } catch {
      return value.slice(prefix.length);
    }
  }
  return "";
};

const authenticateSocket = async (socket, next) => {
  try {
    const token = readCookie(socket.request.headers.cookie, "studyflux_token");
    if (!token) return next(new Error("AUTH_REQUIRED"));

    const payload = verifyAuthToken(token);
    const user = await User.findById(payload.sub)
      .select("_id role isActive isEmailVerified authVersion")
      .lean();

    if (
      !user ||
      !user.isActive ||
      user.isEmailVerified !== true ||
      Number(payload.av ?? 0) !== Number(user.authVersion ?? 0)
    ) {
      return next(new Error("INVALID_SESSION"));
    }

    socket.data.userId = String(user._id);
    socket.data.role = user.role;
    socket.data.authVersion = Number(user.authVersion || 0);
    socket.join(`user:${String(user._id)}`);
    return next();
  } catch {
    return next(new Error("INVALID_SESSION"));
  }
};

const revalidateSocketSession = async (socket) => {
  const user = await User.findById(socket.data.userId)
    .select("_id isActive isEmailVerified authVersion")
    .lean();

  const valid = Boolean(
    user &&
      user.isActive &&
      user.isEmailVerified === true &&
      Number(user.authVersion || 0) === Number(socket.data.authVersion || 0),
  );

  if (!valid) socket.disconnect(true);
  return valid;
};

export const initializeSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        return callback(null, isAllowedClientOrigin(origin));
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    allowRequest(req, callback) {
      const origin = String(req.headers.origin || "").trim();
      callback(null, !origin || isAllowedClientOrigin(origin));
    },
    maxHttpBufferSize: 100_000,
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const authRefreshTimer = setInterval(() => {
      revalidateSocketSession(socket).catch(() => socket.disconnect(true));
    }, 60 * 1000);
    authRefreshTimer.unref?.();
    socket.once("disconnect", () => clearInterval(authRefreshTimer));

    socket.on("community:join-poll", async (pollId) => {
      if (typeof pollId !== "string" || !/^[a-f0-9]{24}$/i.test(pollId)) return;
      try {
        if (await revalidateSocketSession(socket)) socket.join(`poll:${pollId}`);
      } catch {
        socket.disconnect(true);
      }
    });

    socket.on("community:leave-poll", (pollId) => {
      if (typeof pollId === "string" && /^[a-f0-9]{24}$/i.test(pollId)) {
        socket.leave(`poll:${pollId}`);
      }
    });

    socket.on("leaderboard:join", async () => {
      try {
        if (await revalidateSocketSession(socket)) socket.join("leaderboard");
      } catch {
        socket.disconnect(true);
      }
    });
    socket.on("leaderboard:leave", () => socket.leave("leaderboard"));

    socket.on("study-session:join", async (sessionId) => {
      if (typeof sessionId !== "string" || !/^[a-f0-9]{24}$/i.test(sessionId)) return;

      try {
        if (!(await revalidateSocketSession(socket))) return;
        const owned = await StudySession.exists({
          _id: sessionId,
          user: socket.data.userId,
        });
        if (owned) socket.join(`study-session:${sessionId}`);
      } catch {
        socket.disconnect(true);
      }
    });

    socket.on("study-session:leave", (sessionId) => {
      if (typeof sessionId === "string" && /^[a-f0-9]{24}$/i.test(sessionId)) {
        socket.leave(`study-session:${sessionId}`);
      }
    });
  });

  return io;
};

export const disconnectUserSockets = (userId) => {
  if (!io || !userId) return;
  io.in(`user:${String(userId)}`).disconnectSockets(true);
};

export const closeSocketServer = async () => {
  if (!io) return;
  const current = io;
  io = null;
  current.disconnectSockets(true);
  await new Promise((resolve) => current.close(() => resolve()));
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

export const emitStudySessionChanged = (sessionId, payload = {}) => {
  if (!io) return;
  io.to(`study-session:${String(sessionId)}`).emit("study-session:changed", {
    sessionId: String(sessionId),
    updatedAt: new Date().toISOString(),
    ...payload,
  });
};
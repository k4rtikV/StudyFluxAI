import { io } from "socket.io-client";

const API_ORIGIN = String(import.meta.env.VITE_API_ORIGIN || "").replace(/\/+$/, "");
let socket = null;

export const getRealtimeSocket = () => {
  if (!socket) {
    socket = io(API_ORIGIN || undefined, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 750,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
  }
  return socket;
};

import { io } from "socket.io-client";

const API_ORIGIN = "http://localhost:5000";

let socket = null;

export const getCommunitySocket = () => {
  if (!socket) {
    socket = io(API_ORIGIN, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }

  return socket;
};

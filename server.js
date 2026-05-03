const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const HISTORY_LIMIT = 50;
const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT = { windowMs: 5000, max: 8 }; // max messages per window per socket

// In-memory state. rooms: roomName -> { users: Map<socketId, username>, history: [] }
const rooms = new Map();

function getRoom(name) {
  if (!rooms.has(name)) rooms.set(name, { users: new Map(), history: [] });
  return rooms.get(name);
}

function clean(str, max) {
  return String(str || "").trim().slice(0, max);
}

function roomList() {
  return [...rooms.entries()]
    .filter(([, r]) => r.users.size > 0)
    .map(([name, r]) => ({ name, count: r.users.size }));
}

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, rooms: roomList() }));

io.on("connection", (socket) => {
  let current = null; // { room, username }
  let sentTimestamps = [];

  socket.emit("rooms", roomList());

  socket.on("join", ({ username, room }, ack) => {
    username = clean(username, 20);
    room = clean(room, 30).toLowerCase() || "general";
    if (!username) return ack?.({ error: "Username is required" });

    const target = getRoom(room);
    const taken = [...target.users.values()].some((u) => u.toLowerCase() === username.toLowerCase());
    if (taken) return ack?.({ error: "That name is taken in this room" });

    leaveCurrent();
    current = { room, username };
    target.users.set(socket.id, username);
    socket.join(room);

    ack?.({ ok: true, room, history: target.history });
    socket.to(room).emit("system", `${username} joined`);
    io.to(room).emit("users", [...target.users.values()]);
    io.emit("rooms", roomList());
  });

  socket.on("message", (text, ack) => {
    if (!current) return ack?.({ error: "Join a room first" });
    text = clean(text, MAX_MESSAGE_LENGTH);
    if (!text) return;

    const now = Date.now();
    sentTimestamps = sentTimestamps.filter((t) => now - t < RATE_LIMIT.windowMs);
    if (sentTimestamps.length >= RATE_LIMIT.max) {
      return ack?.({ error: "You're sending messages too fast" });
    }
    sentTimestamps.push(now);

    const msg = { id: `${now}-${socket.id}`, user: current.username, text, ts: now };
    const room = getRoom(current.room);
    room.history.push(msg);
    if (room.history.length > HISTORY_LIMIT) room.history.shift();

    io.to(current.room).emit("message", msg);
    ack?.({ ok: true });
  });

  socket.on("typing", (isTyping) => {
    if (!current) return;
    socket.to(current.room).emit("typing", { user: current.username, isTyping: !!isTyping });
  });

  function leaveCurrent() {
    if (!current) return;
    const { room, username } = current;
    const r = getRoom(room);
    r.users.delete(socket.id);
    socket.leave(room);
    socket.to(room).emit("system", `${username} left`);
    socket.to(room).emit("typing", { user: username, isTyping: false });
    io.to(room).emit("users", [...r.users.values()]);
    if (r.users.size === 0) rooms.delete(room); // drop empty rooms and their history
    current = null;
  }

  socket.on("leave", () => {
    leaveCurrent();
    io.emit("rooms", roomList());
  });

  socket.on("disconnect", () => {
    leaveCurrent();
    io.emit("rooms", roomList());
  });
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Chat server running on http://localhost:${PORT}`));
}

module.exports = { server, io };

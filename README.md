# PulseChat — Realtime Chat App

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Render-brightgreen?style=for-the-badge&logo=render)](https://realtime-chat-app-sxj8.onrender.com)

**Live App**: [https://realtime-chat-app-sxj8.onrender.com](https://realtime-chat-app-sxj8.onrender.com)

A multi-room, real-time glassmorphism chat application built with **Node.js, Express, and Socket.IO**. Users pick a name, join or create a room, and chat live with typing indicators, an online-users list, and message history.

## Features

- **Rooms**: join any room by name; active rooms and their user counts update live
- **Presence**: online-users list per room, join/leave notifications
- **Typing indicators**, debounced so the server isn't flooded on every keystroke
- **Message history**: the last 50 messages are replayed to anyone who joins
- **Server-side validation**: length limits, unique names per room (case-insensitive)
- **Rate limiting**: max 8 messages per 5 seconds per connection
- **XSS-safe rendering**: messages are inserted with `textContent`, never `innerHTML`
- **Auto-rejoin** after a dropped connection
- **Responsive UI**, with the sidebar hidden on mobile
- **Integration tests** using real Socket.IO clients

## How it works

```
Browser (client.js) ──websocket──► server.js (Socket.IO)
     emits: join, message, typing, leave      rooms: Map<room, {users, history}>
     listens: message, system, users,         broadcasts to room members only
              typing, rooms                   via socket.join(room) / io.to(room)
```

Acknowledgement callbacks are used for `join` and `message`, so the client learns right away if a name is taken or it's being rate-limited.

## Run it

```bash
npm install
npm start
```

Open http://localhost:3000 in two browser windows and chat between them.

Run the tests:

```bash
npm test
```

## Project structure

```
server.js          # Express + Socket.IO server, room and presence logic
public/index.html  # UI markup
public/client.js   # socket events, rendering, typing debounce
public/style.css   # styles
test/chat.test.js  # integration tests (node:test + socket.io-client)
```

## Possible extensions

- Persist messages in MongoDB or Redis
- Scale horizontally with the Socket.IO Redis adapter
- Private direct messages and read receipts
- Authentication with JWT

## Tech stack

Node.js, Express, Socket.IO, vanilla JavaScript, CSS

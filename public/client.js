const socket = io();
const $ = (id) => document.getElementById(id);
let me = null;
const typingUsers = new Set();
let typingTimer = null;
let amTyping = false;

function show(section) {
  $("login").classList.toggle("hidden", section !== "login");
  $("chat").classList.toggle("hidden", section !== "chat");
}

function time(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function addMessage(msg) {
  const li = document.createElement("li");
  li.className = msg.user === me ? "mine" : "";
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = `${msg.user} · ${time(msg.ts)}`;
  const body = document.createElement("div");
  body.textContent = msg.text; // textContent, never innerHTML, to prevent XSS
  li.append(meta, body);
  $("messages").appendChild(li);
  $("messages").scrollTop = $("messages").scrollHeight;
}

function addSystem(text) {
  const li = document.createElement("li");
  li.className = "system";
  li.textContent = text;
  $("messages").appendChild(li);
  $("messages").scrollTop = $("messages").scrollHeight;
}

function renderTyping() {
  const names = [...typingUsers];
  $("typing").textContent =
    names.length === 0 ? "" :
    names.length === 1 ? `${names[0]} is typing...` :
    `${names.length} people are typing...`;
}

$("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const username = $("username").value;
  const room = $("room").value || "general";
  socket.emit("join", { username, room }, (res) => {
    if (res.error) return ($("loginError").textContent = res.error);
    me = username.trim();
    $("loginError").textContent = "";
    $("roomTitle").textContent = `# ${res.room}`;
    $("messages").innerHTML = "";
    res.history.forEach(addMessage);
    show("chat");
    $("msgInput").focus();
  });
});

$("msgForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("msgInput").value;
  if (!text.trim()) return;
  socket.emit("message", text, (res) => {
    $("msgError").textContent = res?.error || "";
  });
  $("msgInput").value = "";
  stopTyping();
});

function stopTyping() {
  if (amTyping) socket.emit("typing", false);
  amTyping = false;
  clearTimeout(typingTimer);
}

$("msgInput").addEventListener("input", () => {
  if (!amTyping) {
    amTyping = true;
    socket.emit("typing", true);
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, 1500); // debounce: stop after 1.5s idle
});

$("leaveBtn").addEventListener("click", () => {
  socket.emit("leave");
  typingUsers.clear();
  renderTyping();
  show("login");
});

socket.on("message", addMessage);
socket.on("system", addSystem);

socket.on("users", (users) => {
  $("users").innerHTML = "";
  users.forEach((u) => {
    const li = document.createElement("li");
    li.textContent = u === me ? `${u} (you)` : u;
    $("users").appendChild(li);
  });
});

socket.on("typing", ({ user, isTyping }) => {
  isTyping ? typingUsers.add(user) : typingUsers.delete(user);
  renderTyping();
});

socket.on("rooms", (rooms) => {
  $("roomOptions").innerHTML = "";
  rooms.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r.name;
    $("roomOptions").appendChild(opt);
  });
  $("activeRooms").textContent = rooms.length
    ? "Active rooms: " + rooms.map((r) => `${r.name} (${r.count})`).join(", ")
    : "No active rooms yet. Start one!";
});

socket.on("disconnect", () => addSystem("Disconnected. Reconnecting..."));
socket.on("connect", () => {
  if (me && !$("chat").classList.contains("hidden")) {
    // Rejoin the same room after a reconnect.
    const room = $("roomTitle").textContent.replace("# ", "");
    socket.emit("join", { username: me, room }, () => addSystem("Reconnected"));
  }
});

const socket = io();
const $ = (id) => document.getElementById(id);
let me = null;
const typingUsers = new Set();
let typingTimer = null;
let amTyping = false;

// Avatar color generator based on username string hash
const avatarGradients = [
  'linear-gradient(135deg, #f43f5e, #fb7185)',
  'linear-gradient(135deg, #8b5cf6, #c084fc)',
  'linear-gradient(135deg, #06b6d4, #38bdf8)',
  'linear-gradient(135deg, #10b981, #34d399)',
  'linear-gradient(135deg, #f59e0b, #fbbf24)',
  'linear-gradient(135deg, #ec4899, #f472b6)'
];

function getAvatarStyle(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatarGradients.length;
  return avatarGradients[index];
}

function show(section) {
  $("login").classList.toggle("hidden", section !== "login");
  $("chat").classList.toggle("hidden", section !== "chat");
  closeSidebar();
}

function time(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function addMessage(msg) {
  const isMine = msg.user === me;
  const li = document.createElement("li");
  li.className = isMine ? "mine" : "";

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = `${msg.user} · ${time(msg.ts)}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = msg.text; // XSS protection preserved

  li.append(meta, bubble);
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
  if (names.length === 0) {
    $("typing").textContent = "";
  } else {
    const text = names.length === 1 ? `${names[0]} is typing...` : `${names.length} people are typing...`;
    $("typing").innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="animation: pulse 1s infinite"><circle cx="4" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="20" cy="12" r="2"/></svg>
      <span>${text}</span>
    `;
  }
}

// Login Form Submit
$("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const username = $("username").value;
  const room = $("room").value || "general";
  
  socket.emit("join", { username, room }, (res) => {
    if (res.error) return ($("loginError").textContent = res.error);
    me = username.trim();
    $("loginError").textContent = "";
    $("roomTitle").textContent = `# ${res.room}`;
    if ($("mobileRoomTitle")) $("mobileRoomTitle").textContent = res.room;
    $("messages").innerHTML = "";
    res.history.forEach(addMessage);
    show("chat");
    $("msgInput").focus();
  });
});

// Send Message
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
  typingTimer = setTimeout(stopTyping, 1500);
});

// Leave Room
$("leaveBtn").addEventListener("click", () => {
  socket.emit("leave");
  typingUsers.clear();
  renderTyping();
  show("login");
});

// Socket Listeners
socket.on("message", addMessage);
socket.on("system", addSystem);

socket.on("users", (users) => {
  $("users").innerHTML = "";
  if ($("userCount")) $("userCount").textContent = users.length;
  
  users.forEach((u) => {
    const li = document.createElement("li");
    const avatar = document.createElement("div");
    avatar.className = "user-avatar";
    avatar.style.background = getAvatarStyle(u);
    avatar.textContent = u.charAt(0).toUpperCase();

    const nameSpan = document.createElement("span");
    nameSpan.textContent = u;

    li.append(avatar, nameSpan);

    if (u === me) {
      const youPill = document.createElement("span");
      youPill.className = "you-pill";
      youPill.textContent = "you";
      li.appendChild(youPill);
    }
    
    $("users").appendChild(li);
  });
});

socket.on("typing", ({ user, isTyping }) => {
  isTyping ? typingUsers.add(user) : typingUsers.delete(user);
  renderTyping();
});

socket.on("rooms", (rooms) => {
  $("roomOptions").innerHTML = "";
  $("activeRooms").innerHTML = "";

  if (rooms.length === 0) {
    const emptySpan = document.createElement("span");
    emptySpan.style.color = "var(--text-muted)";
    emptySpan.style.fontSize = "13px";
    emptySpan.textContent = "No active rooms right now. Type a room name above!";
    $("activeRooms").appendChild(emptySpan);
    return;
  }

  rooms.forEach((r) => {
    // Datalist option
    const opt = document.createElement("option");
    opt.value = r.name;
    $("roomOptions").appendChild(opt);

    // Clickable Chip for login view
    const chip = document.createElement("div");
    chip.className = "room-chip";
    chip.innerHTML = `<span># ${r.name}</span><span class="badge">${r.count}</span>`;
    chip.addEventListener("click", () => {
      $("room").value = r.name;
      $("username").focus();
    });
    $("activeRooms").appendChild(chip);
  });
});

socket.on("disconnect", () => addSystem("Disconnected from server. Reconnecting..."));
socket.on("connect", () => {
  if (me && !$("chat").classList.contains("hidden")) {
    const room = $("roomTitle").textContent.replace("# ", "");
    socket.emit("join", { username: me, room }, () => addSystem("Reconnected to room"));
  }
});

// Mobile Sidebar Drawer Controls
const toggleBtn = $("toggleSidebarBtn");
const sidebar = $("chatSidebar");
const overlay = $("sidebarOverlay");

function openSidebar() {
  if (sidebar && overlay) {
    sidebar.classList.add("open");
    overlay.classList.remove("hidden");
  }
}

function closeSidebar() {
  if (sidebar && overlay) {
    sidebar.classList.remove("open");
    overlay.classList.add("hidden");
  }
}

if (toggleBtn) toggleBtn.addEventListener("click", openSidebar);
if (overlay) overlay.addEventListener("click", closeSidebar);

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { io: Client } = require("socket.io-client");
const { server } = require("../server");

let url;
before(() => new Promise((resolve) => {
  server.listen(0, () => {
    url = `http://localhost:${server.address().port}`;
    resolve();
  });
}));
after(() => new Promise((resolve) => server.close(resolve)));

const connect = () => new Promise((resolve) => {
  const c = Client(url, { forceNew: true });
  c.on("connect", () => resolve(c));
});
const join = (c, username, room) => new Promise((resolve) => c.emit("join", { username, room }, resolve));

test("message is broadcast to everyone in the room", async () => {
  const a = await connect();
  const b = await connect();
  await join(a, "alice", "test1");
  await join(b, "bob", "test1");
  const received = new Promise((resolve) => b.on("message", resolve));
  a.emit("message", "hello bob");
  const msg = await received;
  assert.strictEqual(msg.text, "hello bob");
  assert.strictEqual(msg.user, "alice");
  a.close(); b.close();
});

test("duplicate username in the same room is rejected", async () => {
  const a = await connect();
  const b = await connect();
  await join(a, "carol", "test2");
  const res = await join(b, "Carol", "test2");
  assert.match(res.error, /taken/);
  a.close(); b.close();
});

test("history is sent to users who join later", async () => {
  const a = await connect();
  await join(a, "dave", "test3");
  await new Promise((resolve) => a.emit("message", "first!", resolve));
  const b = await connect();
  const res = await join(b, "erin", "test3");
  assert.strictEqual(res.history.at(-1).text, "first!");
  a.close(); b.close();
});

test("rate limiting kicks in", async () => {
  const a = await connect();
  await join(a, "frank", "test4");
  let lastRes;
  for (let i = 0; i < 10; i++) {
    lastRes = await new Promise((resolve) => a.emit("message", `m${i}`, resolve));
  }
  assert.match(lastRes.error, /too fast/);
  a.close();
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../src/app.js";
import { config } from "../src/config.js";
import { connectDb, disconnectDb } from "../src/db.js";
import { PasswordReset } from "../src/models/password-reset.js";
import { User } from "../src/models/user.js";

let server: Server;
let base = "";

before(async () => {
  await connectDb();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.close();
  await disconnectDb();
});

/** A tiny browser: remembers the session cookie between requests. */
class Browser {
  cookie = "";
  async call(method: string, path: string, body?: unknown) {
    const res = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(this.cookie ? { cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const header of res.headers.getSetCookie()) {
      if (!header.startsWith(`${config.cookieName}=`)) continue;
      const pair = header.split(";")[0];
      this.cookie = pair === `${config.cookieName}=` ? "" : pair;
    }
    const json: any = await res.json().catch(() => null);
    return { status: res.status, json };
  }
}

async function signedIn(email: string) {
  const browser = new Browser();
  const res = await browser.call("POST", "/api/auth/register", { name: "Test Manager", email, password: "Passw0rdOk" });
  assert.equal(res.status, 201);
  return browser;
}

test("auth: register, session, logout and login", async () => {
  const b = new Browser();
  const weak = await b.call("POST", "/api/auth/register", { name: "Ann", email: "ann@example.com", password: "password" });
  assert.equal(weak.status, 400);
  assert.match(weak.json.error, /number/i);

  const ok = await b.call("POST", "/api/auth/register", { name: "Ann", email: "ann@example.com", password: "Passw0rdOk" });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.user.email, "ann@example.com");
  assert.equal(ok.json.user.passwordHash, undefined, "never expose the password hash");

  const dup = await new Browser().call("POST", "/api/auth/register", {
    name: "Ann Two",
    email: "ANN@example.com",
    password: "Passw0rdOk",
  });
  assert.equal(dup.status, 409);

  assert.equal((await b.call("GET", "/api/auth/me")).json.user.name, "Ann");
  assert.equal((await b.call("PATCH", "/api/auth/me", { name: "Ann B" })).json.user.name, "Ann B");

  await b.call("POST", "/api/auth/logout");
  assert.equal((await b.call("GET", "/api/auth/me")).json.user, null);

  const wrong = await b.call("POST", "/api/auth/login", { email: "ann@example.com", password: "nope" });
  assert.equal(wrong.status, 401);
  const right = await b.call("POST", "/api/auth/login", { email: "ann@example.com", password: "Passw0rdOk" });
  assert.equal(right.status, 200);
});

test("API requires a session", async () => {
  const anon = new Browser();
  assert.equal((await anon.call("GET", "/api/desk")).status, 401);
  assert.equal((await anon.call("POST", "/api/queues", { name: "X", code: "X" })).status, 401);
});

test("queue flow: tokens, reorder, assign, cancel, finish, edit", async () => {
  const b = await signedIn("flow@example.com");

  assert.equal((await b.call("POST", "/api/queues", { name: "", code: "A" })).status, 400);
  assert.equal((await b.call("POST", "/api/queues", { name: "Front", code: "TOOLONG" })).status, 400);
  const created = await b.call("POST", "/api/queues", { name: "Front desk", code: "a" });
  assert.equal(created.status, 201);
  assert.equal(created.json.queue.code, "A");
  const qid = created.json.queue.id as string;
  assert.equal((await b.call("POST", "/api/queues", { name: "Again", code: "A" })).status, 409);

  const ids: string[] = [];
  for (const [i, person] of ["Asha", "Ben", "Chen"].entries()) {
    const added = await b.call("POST", `/api/queues/${qid}/tokens`, { personName: person, note: "n" });
    assert.equal(added.status, 201);
    assert.equal(added.json.number, i + 1, "token numbers count up from 1");
    assert.equal(added.json.code, "A");
  }
  assert.equal((await b.call("POST", `/api/queues/${qid}/tokens`, { personName: "  " })).status, 400);

  const names = async () => {
    const res = await b.call("GET", `/api/queues/${qid}/tokens`);
    return (res.json as { personName: string; status: string; id: string }[]).filter((t) => t.status === "waiting");
  };
  let waiting = await names();
  assert.deepEqual(waiting.map((t) => t.personName), ["Asha", "Ben", "Chen"]);
  ids.push(...waiting.map((t) => t.id));

  // arrow buttons
  await b.call("PATCH", `/api/tokens/${ids[2]}/position`, { direction: "up" });
  assert.deepEqual((await names()).map((t) => t.personName), ["Asha", "Chen", "Ben"]);
  // drag and drop to the top
  await b.call("PATCH", `/api/tokens/${ids[1]}/position`, { toIndex: 0 });
  assert.deepEqual((await names()).map((t) => t.personName), ["Ben", "Asha", "Chen"]);
  // moving the first one up is a no-op, not an error
  assert.equal((await b.call("PATCH", `/api/tokens/${ids[1]}/position`, { direction: "up" })).status, 200);

  // assign for service calls the top of the line
  const first = await b.call("POST", `/api/queues/${qid}/call-next`);
  assert.equal(first.json.called.personName, "Ben");
  let desk = (await b.call("GET", "/api/desk")).json;
  assert.equal(desk.queues[0].servingName, "Ben");
  assert.equal(desk.queues[0].waiting, 2);

  // calling again finishes Ben first, then calls Asha
  const second = await b.call("POST", `/api/queues/${qid}/call-next`);
  assert.equal(second.json.called.personName, "Asha");
  const all = (await b.call("GET", `/api/queues/${qid}/tokens`)).json as { personName: string; status: string }[];
  assert.equal(all.find((t) => t.personName === "Ben")?.status, "served");
  assert.equal(all.filter((t) => t.status === "serving").length, 1);

  // cancel a waiting token
  const cancel = await b.call("POST", `/api/tokens/${ids[2]}/cancel`);
  assert.equal(cancel.json.personName, "Chen");
  assert.equal((await b.call("POST", `/api/tokens/${ids[2]}/cancel`)).status, 400, "cannot cancel twice");
  assert.equal((await b.call("PATCH", `/api/tokens/${ids[2]}/position`, { direction: "up" })).status, 400);

  // nobody waiting: assign does nothing, finish serves Asha
  assert.equal((await b.call("POST", `/api/queues/${qid}/call-next`)).json.called, null);
  assert.equal((await b.call("POST", `/api/queues/${qid}/finish`)).json.personName, "Asha");
  assert.equal((await b.call("POST", `/api/queues/${qid}/finish`)).status, 400);

  // edit name and code
  const edited = await b.call("PATCH", `/api/queues/${qid}`, { name: "Main desk", code: "m" });
  assert.deepEqual(edited.json.queue, { id: qid, name: "Main desk", code: "M" });
  const second2 = await b.call("POST", "/api/queues", { name: "Pharmacy", code: "P" });
  assert.equal((await b.call("PATCH", `/api/queues/${qid}`, { name: "Main desk", code: "P" })).status, 409);
  assert.equal(second2.status, 201);

  // numbers are never reused, even after tokens are handled
  const later = await b.call("POST", `/api/queues/${qid}/tokens`, { personName: "Dee" });
  assert.equal(later.json.number, 4);

  const insights = (await b.call("GET", "/api/insights?range=today&tz=0")).json;
  assert.equal(insights.waitingNow, 1);
  assert.equal(insights.served, 2);
  assert.equal(insights.cancelled, 1);
  assert.equal(insights.byQueue.length, 2);

  // deleting a queue removes it
  assert.equal((await b.call("DELETE", `/api/queues/${second2.json.queue.id}`)).status, 200);
  desk = (await b.call("GET", "/api/desk")).json;
  assert.equal(desk.queues.length, 1);
  waiting = await names();
  assert.equal(waiting.length, 1);
});

test("one manager cannot see or change another manager's queues", async () => {
  const alice = await signedIn("alice@example.com");
  const bob = await signedIn("bob@example.com");
  const q = (await alice.call("POST", "/api/queues", { name: "Private", code: "Z" })).json.queue.id as string;
  await alice.call("POST", `/api/queues/${q}/tokens`, { personName: "Secret" });
  const tokenId = ((await alice.call("GET", `/api/queues/${q}/tokens`)).json as { id: string }[])[0].id;

  assert.equal((await bob.call("GET", `/api/queues/${q}/tokens`)).status, 404);
  assert.equal((await bob.call("PATCH", `/api/queues/${q}`, { name: "Hacked", code: "Z" })).status, 404);
  assert.equal((await bob.call("DELETE", `/api/queues/${q}`)).status, 404);
  assert.equal((await bob.call("POST", `/api/queues/${q}/tokens`, { personName: "X" })).status, 404);
  assert.equal((await bob.call("POST", `/api/tokens/${tokenId}/cancel`)).status, 400);
  assert.equal((await bob.call("PATCH", `/api/tokens/${tokenId}/position`, { toIndex: 0 })).status, 404);
  assert.equal((await bob.call("GET", "/api/desk")).json.queues.length, 0);
  assert.equal((await bob.call("GET", "/api/queues/not-an-id/tokens")).status, 404);
});

test("demo data fills the dashboard", async () => {
  const b = await signedIn("demo@example.com");
  const res = await b.call("POST", "/api/demo");
  assert.equal(res.status, 201);
  const desk = (await b.call("GET", "/api/desk")).json;
  assert.equal(desk.queues.length, 2);
  assert.ok(desk.queues.every((q: { servingName: string | null }) => q.servingName), "each demo queue has someone in service");
  const insights = (await b.call("GET", "/api/insights?range=today&tz=0")).json;
  assert.ok(insights.served > 0);
  assert.ok(insights.avgWaitSec > 0);
  // loading twice keeps both sets, with unique codes
  assert.equal((await b.call("POST", "/api/demo")).status, 201);
  const codes = (await b.call("GET", "/api/desk")).json.queues.map((q: { code: string }) => q.code);
  assert.equal(new Set(codes).size, 4);
});

test("password reset: link works once, new password replaces the old", async () => {
  await signedIn("reset@example.com");

  // Demo mode (DEMO_SHOW_RESET_LINK=true in the test run) returns the link for real accounts only.
  const unknown = await new Browser().call("POST", "/api/auth/forgot-password", { email: "nobody@example.com" });
  assert.deepEqual(unknown.json, { ok: true }, "an unknown email gets no link");
  const known = await new Browser().call("POST", "/api/auth/forgot-password", { email: "reset@example.com" });
  assert.match(known.json.demoLink, /^\/reset-password\?token=[0-9a-f]{64}$/);
  const token = new URL(known.json.demoLink, "http://localhost").searchParams.get("token")!;

  const weak = await new Browser().call("POST", "/api/auth/reset-password", { token, password: "short" });
  assert.equal(weak.status, 400);
  const done = await new Browser().call("POST", "/api/auth/reset-password", { token, password: "BrandNew123" });
  assert.equal(done.status, 200);
  assert.equal((await new Browser().call("POST", "/api/auth/reset-password", { token, password: "Another123" })).status, 400, "a link works once");

  const fresh = new Browser();
  assert.equal((await fresh.call("POST", "/api/auth/login", { email: "reset@example.com", password: "Passw0rdOk" })).status, 401);
  assert.equal((await fresh.call("POST", "/api/auth/login", { email: "reset@example.com", password: "BrandNew123" })).status, 200);

  // An expired link is refused.
  const user = await User.findOne({ email: "reset@example.com" });
  const expired = "b".repeat(40);
  await PasswordReset.create({
    userId: user!._id,
    tokenHash: createHash("sha256").update(expired).digest("hex"),
    expiresAt: new Date(Date.now() - 1000),
  });
  assert.equal((await new Browser().call("POST", "/api/auth/reset-password", { token: expired, password: "Another123" })).status, 400);
});

test("change password: needs the current one and signs other devices out", async () => {
  const phone = await signedIn("change@example.com");
  const laptop = new Browser();
  assert.equal((await laptop.call("POST", "/api/auth/login", { email: "change@example.com", password: "Passw0rdOk" })).status, 200);

  assert.equal((await new Browser().call("POST", "/api/auth/change-password", { currentPassword: "x", newPassword: "NewPassw0rd" })).status, 401);
  const wrong = await phone.call("POST", "/api/auth/change-password", { currentPassword: "WrongPass1", newPassword: "NewPassw0rd" });
  assert.equal(wrong.status, 400);
  assert.match(wrong.json.error, /current password/i);
  assert.equal((await phone.call("POST", "/api/auth/change-password", { currentPassword: "Passw0rdOk", newPassword: "Passw0rdOk" })).status, 400);
  assert.equal((await phone.call("POST", "/api/auth/change-password", { currentPassword: "Passw0rdOk", newPassword: "short" })).status, 400);

  // Session tokens carry whole seconds, so wait one so the older session is clearly older.
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal((await phone.call("POST", "/api/auth/change-password", { currentPassword: "Passw0rdOk", newPassword: "NewPassw0rd" })).status, 200);

  assert.equal((await phone.call("GET", "/api/auth/me")).json.user.email, "change@example.com", "this device stays signed in");
  assert.equal((await laptop.call("GET", "/api/auth/me")).json.user, null, "other devices are signed out");
  assert.equal((await new Browser().call("POST", "/api/auth/login", { email: "change@example.com", password: "Passw0rdOk" })).status, 401);
  assert.equal((await new Browser().call("POST", "/api/auth/login", { email: "change@example.com", password: "NewPassw0rd" })).status, 200);
});

test("cross-site writes are blocked", async () => {
  const b = await signedIn("csrf@example.com");
  const res = await fetch(`${base}/api/queues`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: b.cookie, origin: "https://evil.example" },
    body: JSON.stringify({ name: "X", code: "X" }),
  });
  assert.equal(res.status, 403);
});

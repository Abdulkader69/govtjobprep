import { describe, it, expect, beforeEach } from "vitest";
import { createLocalAuth } from "../auth.local.js";

// The local adapter runs in Node here, where there is no localStorage. It must
// cope, since private-mode browsers behave the same way.
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("local auth adapter", () => {
  let auth, seen;
  beforeEach(async () => {
    auth = createLocalAuth();
    seen = [];
    auth.subscribe((s) => seen.push(s));
    await tick();
  });

  it("starts signed out and becomes ready", () => {
    expect(seen.at(-1)).toMatchObject({ user: null, ready: true, kicked: null });
  });

  it("registers via phone, email optional", async () => {
    const r = await auth.register({ name: " Rahim ", via: "phone", phone: "+880 1748-114144", password: "secret1" });
    expect(r.ok).toBe(true);
    expect(seen.at(-1).user).toMatchObject({ name: "Rahim", phone: "01748114144", email: null, plan: "full", unlocked: true, isAdmin: true });
  });

  it("registers via email, phone optional", async () => {
    await auth.register({ name: "Karim", via: "email", email: "K@x.bd", password: "secret1" });
    expect(seen.at(-1).user).toMatchObject({ email: "k@x.bd", phone: null });
    await auth.logout();
    await auth.register({ name: "Karim", via: "email", email: "k@x.bd", phone: "01911111111", password: "secret1" });
    expect(seen.at(-1).user).toMatchObject({ email: "k@x.bd", phone: "01911111111" });
  });

  it("validates registration fields per identity type", async () => {
    expect(await auth.register({ name: "", via: "phone", phone: "01748114144", password: "secret1" })).toMatchObject({ ok: false });
    expect(await auth.register({ name: "R", via: "phone", phone: "12", password: "secret1" })).toMatchObject({ ok: false, code: "INVALID_PHONE" });
    expect(await auth.register({ name: "R", via: "phone", phone: "01748114144", email: "nope", password: "secret1" })).toMatchObject({ ok: false, code: "INVALID_EMAIL" });
    expect(await auth.register({ name: "R", via: "email", email: "", password: "secret1" })).toMatchObject({ ok: false, code: "INVALID_EMAIL" });
    expect(await auth.register({ name: "R", via: "email", email: "r@x.bd", phone: "12", password: "secret1" })).toMatchObject({ ok: false, code: "INVALID_PHONE" });
    expect(await auth.register({ name: "R", via: "phone", phone: "01748114144", password: "123" })).toMatchObject({ ok: false, code: "WEAK_PASSWORD" });
    expect(await auth.register({ name: "R", via: "x", email: "r@x.bd", phone: "01748114144", password: "secret1" })).toMatchObject({ ok: false, code: "INVALID_IDENTIFIER" });
  });

  it("logs in with a phone or an email, and refuses anything else", async () => {
    expect(await auth.login("01748114144", "pw")).toMatchObject({ ok: true });
    expect(await auth.login("r@x.bd", "pw")).toMatchObject({ ok: true });
    expect(await auth.login("abc", "pw")).toMatchObject({ ok: false, code: "INVALID_IDENTIFIER" });
  });

  it("cannot send a reset link to a phone account", async () => {
    expect(await auth.resetPassword("01748114144")).toMatchObject({ ok: false, code: "NO_RESET_FOR_PHONE" });
    expect(await auth.resetPassword("r@x.bd")).toMatchObject({ ok: true });
  });

  it("has no phone login — that needs Firebase", async () => {
    expect(auth.phoneLogin).toBe(false);
    expect(await auth.sendCode("01711111111")).toMatchObject({ ok: false, code: "PHONE_UNAVAILABLE" });
  });

  it("logout clears the user", async () => {
    await auth.login("01748114144", "pw");
    expect(seen.at(-1).user).not.toBeNull();
    await auth.logout();
    expect(seen.at(-1).user).toBeNull();
  });

  it("never enforces a device limit — it has no way to", () => {
    expect(auth.policy).toBe("none");
  });
});

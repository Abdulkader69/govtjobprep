import { describe, it, expect } from "vitest";
import { classify, loginEmailFor, isPhoneEmail, phoneFromEmail, realEmail, PHONE_EMAIL_DOMAIN } from "../identity.js";

describe("identity", () => {
  it("turns a phone into a synthetic email and back", () => {
    const email = loginEmailFor("+880 1748-114144");
    expect(email).toBe(`01748114144@${PHONE_EMAIL_DOMAIN}`);
    expect(isPhoneEmail(email)).toBe(true);
    expect(phoneFromEmail(email)).toBe("01748114144");
    expect(realEmail(email)).toBeNull();
  });

  it("passes a real email through, lower-cased", () => {
    expect(loginEmailFor(" Rahim@Example.com ")).toBe("rahim@example.com");
    expect(realEmail("rahim@example.com")).toBe("rahim@example.com");
    expect(phoneFromEmail("rahim@example.com")).toBeNull();
  });

  it("rejects things that are neither", () => {
    for (const bad of ["", "  ", "0174811414", "2748114144", "rahim@", "@x.com", "abc"]) {
      expect(loginEmailFor(bad)).toBeNull();
    }
    expect(classify("")).toEqual({ kind: "empty" });
    expect(classify("01911111111")).toEqual({ kind: "phone", phone: "01911111111" });
  });
});

import { normalizePhone } from "./access.js";

/**
 * Accounts are identified by mobile number, but Firebase's password sign-in
 * wants an email. So a phone account's Firebase email is synthetic:
 *
 *     01748114144  →  01748114144@phone.prostuti.invalid
 *
 * `.invalid` is reserved by RFC 2606 and can never resolve, so nothing can
 * ever be delivered there — which is the point: it is an identifier, not an
 * inbox. The user never sees it. Real email addresses still work as
 * identifiers too, for accounts that have one.
 */
export const PHONE_EMAIL_DOMAIN = "phone.prostuti.invalid";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** What kind of identifier the user typed. */
export function classify(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return { kind: "empty" };
  if (raw.includes("@")) return EMAIL.test(raw) ? { kind: "email", email: raw.toLowerCase() } : { kind: "invalid" };
  const phone = normalizePhone(raw);
  return phone.length === 11 && phone.startsWith("01") ? { kind: "phone", phone } : { kind: "invalid" };
}

/** The Firebase email for a typed phone or email; null if it is neither. */
export function loginEmailFor(input) {
  const id = classify(input);
  if (id.kind === "email") return id.email;
  if (id.kind === "phone") return `${id.phone}@${PHONE_EMAIL_DOMAIN}`;
  return null;
}

export function isPhoneEmail(email) {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${PHONE_EMAIL_DOMAIN}`);
}

/** The phone a synthetic email stands for, or null for a real address. */
export function phoneFromEmail(email) {
  return isPhoneEmail(email) ? email.slice(0, email.indexOf("@")) : null;
}

/** A real address, or null when the account's email is synthetic. */
export function realEmail(email) {
  return email && !isPhoneEmail(email) ? email : null;
}

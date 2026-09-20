/** User-facing copy for every auth outcome, keyed by our own codes. */
export const AUTH_MESSAGES = {
  INVALID_PHONE: "১১ সংখ্যার মোবাইল নম্বর দিন (যেমন ০১৭xxxxxxxx)।",
  INVALID_EMAIL: "সঠিক ইমেইল ঠিকানা দিন।",
  INVALID_IDENTIFIER: "১১ সংখ্যার মোবাইল নম্বর (যেমন ০১৭xxxxxxxx) বা ইমেইল দিন।",
  PHONE_IN_USE: "এই নম্বর দিয়ে আগেই অ্যাকাউন্ট খোলা আছে। লগইন করুন।",
  NO_RESET_FOR_PHONE: "মোবাইল নম্বরের অ্যাকাউন্টে রিসেট লিংক পাঠানো যায় না। অ্যাডমিনের সাথে যোগাযোগ করুন — অ্যাকাউন্টটি মুছে দিলে একই নম্বরে আবার রেজিস্টার করতে পারবেন।",
  WEAK_PASSWORD: "পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।",
  EMAIL_IN_USE: "এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট খোলা আছে। লগইন করুন।",
  WRONG_CREDENTIALS: "মোবাইল নম্বর/ইমেইল বা পাসওয়ার্ড ভুল। যেটা দিয়ে রেজিস্টার করেছিলেন সেটাই দিন।",
  USER_DISABLED: "এই অ্যাকাউন্টটি বন্ধ করা হয়েছে। প্রশ্ন থাকলে অ্যাডমিনের সাথে যোগাযোগ করুন।",
  INVALID_CODE: "কোডটি ভুল। আবার দেখে দিন।",
  CODE_EXPIRED: "কোডের মেয়াদ শেষ। নতুন কোড পাঠান।",
  TOO_MANY: "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
  PHONE_UNAVAILABLE:
    "মোবাইল OTP এখনো চালু হয়নি (Firebase-এ Blaze প্ল্যান লাগে)। ইমেইল দিয়ে লগইন করুন।",
  DEVICE_BUSY: "এই অ্যাকাউন্টটি অন্য একটি ডিভাইসে লগইন করা আছে। সেখান থেকে সাইন আউট করে আবার চেষ্টা করুন।",
  SESSION_REPLACED: "এই অ্যাকাউন্টটি অন্য একটি ডিভাইসে লগইন করা হয়েছে, তাই এখানে সাইন আউট হয়ে গেছে।",
  NO_SESSION: "সেশন শেষ হয়ে গেছে। আবার লগইন করুন।",
  OFFLINE: "সার্ভারে সংযোগ করা যাচ্ছে না। ইন্টারনেট দেখে আবার চেষ্টা করুন।",
  NOT_CONFIGURED: "লগইন ব্যবস্থা এখনো সেটআপ করা হয়নি।",
  CANCELLED: "লগইন বাতিল করা হয়েছে।",
  POPUP_BLOCKED: "ব্রাউজার পপ-আপ আটকে দিয়েছে। এই সাইটের জন্য পপ-আপ চালু করে আবার চেষ্টা করুন।",
  GOOGLE_UNAVAILABLE: "Google লগইন এখনো চালু হয়নি (Firebase কনসোলে Google প্রোভাইডার চালু করতে হবে)।",
  UNAUTHORIZED_DOMAIN: "এই ঠিকানা থেকে লগইন অনুমোদিত নয় (Firebase → Authentication → Authorized domains)।",
  ACCOUNT_EXISTS_OTHER: "এই ইমেইলে আগেই পাসওয়ার্ড দিয়ে অ্যাকাউন্ট খোলা আছে। ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।",
  UNKNOWN: "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।",
};

export function fail(code, extra = {}) {
  return { ok: false, code, message: AUTH_MESSAGES[code] ?? AUTH_MESSAGES.UNKNOWN, ...extra };
}

/** Map a Firebase Auth error to one of our codes. */
export function fromFirebaseError(err) {
  const code = String(err?.code ?? "");
  const table = {
    "auth/invalid-email": "INVALID_EMAIL",
    "auth/missing-email": "INVALID_EMAIL",
    "auth/weak-password": "WEAK_PASSWORD",
    "auth/email-already-in-use": "EMAIL_IN_USE",
    "auth/invalid-credential": "WRONG_CREDENTIALS",
    "auth/wrong-password": "WRONG_CREDENTIALS",
    "auth/user-not-found": "WRONG_CREDENTIALS",
    "auth/invalid-login-credentials": "WRONG_CREDENTIALS",
    "auth/user-disabled": "USER_DISABLED",
    "auth/invalid-verification-code": "INVALID_CODE",
    "auth/missing-verification-code": "INVALID_CODE",
    "auth/code-expired": "CODE_EXPIRED",
    "auth/too-many-requests": "TOO_MANY",
    "auth/quota-exceeded": "TOO_MANY",
    "auth/invalid-phone-number": "INVALID_PHONE",
    "auth/missing-phone-number": "INVALID_PHONE",
    "auth/operation-not-allowed": "PHONE_UNAVAILABLE",
    "auth/billing-not-enabled": "PHONE_UNAVAILABLE",
    "auth/network-request-failed": "OFFLINE",
    "auth/popup-closed-by-user": "CANCELLED",
    "auth/cancelled-popup-request": "CANCELLED",
    "auth/user-cancelled": "CANCELLED",
    "auth/popup-blocked": "POPUP_BLOCKED",
    "auth/unauthorized-domain": "UNAUTHORIZED_DOMAIN",
    "auth/account-exists-with-different-credential": "ACCOUNT_EXISTS_OTHER",
    "unavailable": "OFFLINE",
  };
  if (code === "auth/operation-not-allowed" && !/phone/i.test(String(err?.message))) {
    return fail("UNKNOWN", { detail: err?.message });
  }
  return fail(table[code] ?? "UNKNOWN", { detail: code || err?.message });
}

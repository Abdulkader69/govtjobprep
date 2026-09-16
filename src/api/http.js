const BASE = import.meta.env?.VITE_API_BASE ?? "/api";

/**
 * Laravel-backed implementation. The server owns the clock and the answer key;
 * see docs/api-contract.md for the endpoint shapes.
 */
export const httpApi = {
  profiles: () => request("GET", "/exam-profiles"),

  // The server decides what this session may see from its own session state —
  // never from a flag the browser sends.

  stats: ({ unlocked = false } = {}) => request("GET", `/stats?unlocked=${unlocked}`),

  topics: () => request("GET", "/topics"),

  // Revision content: answers and explanations included by design. Keep this
  // on its own endpoint, never merged into the attempt flow.
  studyQuestions: ({ subject, topic = null, subtopic = null, band = null } = {}) => {
    const qs = new URLSearchParams(
      Object.entries({ subject, topic, subtopic, band }).filter(([, v]) => v)
    );
    return request("GET", `/study?${qs}`);
  },

  startAttempt: ({ band, shuffle = true, count = null, subjects = null, topics = null }) =>
    request("POST", "/attempts", {
      grade_band: band,
      shuffle,
      // The server must clamp `count` to what the band can actually supply, and
      // recompute `minutes` from it — never trust a duration from the client.
      count,
      subjects,
      topics,
    }),

  saveAnswer: ({ attemptId, questionId, option }) =>
    request("PUT", `/attempts/${attemptId}/answers/${questionId}`, { option }),

  // The server holds the attempt; the client just asks whether one is open.
  resumeAttempt: () => request("GET", "/attempts/current"),

  discardAttempt: () => request("DELETE", "/attempts/current"),

  submitAttempt: ({ attemptId, auto = false }) =>
    request("POST", `/attempts/${attemptId}/submit`, { auto }),
};

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...csrfHeader(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 419) throw new ApiError("সেশন মেয়াদোত্তীর্ণ। পাতাটি রিফ্রেশ করুন।", res.status);
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new ApiError(payload.message || "সার্ভারে সমস্যা হয়েছে।", res.status, payload);
  }
  return res.json();
}

function csrfHeader() {
  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  return token ? { "X-CSRF-TOKEN": token } : {};
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

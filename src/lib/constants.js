export const SUBJECTS = [
  { key: "bangla", label: "বাংলা" },
  { key: "english", label: "English" },
  { key: "math", label: "গণিত" },
  { key: "gk", label: "সাধারণ জ্ঞান" },
];

export const SUBJECT_LABEL = Object.fromEntries(
  SUBJECTS.map((s) => [s.key, s.label])
);

export const BANDS = {
  "11-12": { label: "গ্রেড ১১–১২", note: "স্নাতক পর্যায়, কঠিন প্রশ্ন বেশি" },
  "13-16": { label: "গ্রেড ১৩–১৬", note: "সবচেয়ে প্রচলিত ব্যান্ড" },
  "17-20": { label: "গ্রেড ১৭–২০", note: "এসএসসি পর্যায়, সহজ প্রশ্ন বেশি" },
};

export const DIFFICULTY_LABEL = {
  easy: "সহজ",
  medium: "মাঝারি",
  hard: "কঠিন",
};

/** English questions keep Latin option letters; everything else uses ক খ গ ঘ. */
export const letters = (subject) =>
  subject === "english" ? ["a", "b", "c", "d"] : ["ক", "খ", "গ", "ঘ"];

/** The demo paper every visitor may take without signing in. */
export const DEMO_COUNT = 40;
export const DEMO_BAND = "13-16";

/**
 * Question counts offered in the setup dropdown. The list is filtered against
 * what the chosen band can actually supply, so a candidate is never offered a
 * 100-question paper the bank cannot fill.
 */
export const COUNT_OPTIONS = [10, 20, 30, 40, 50, 60, 80, 100];

/** Pre-selected length: long enough to be a real test, short enough to finish. */
export const DEFAULT_COUNT = 40;

/** Questions per page in the preparation room. */
export const PREP_PER_PAGE = 10;


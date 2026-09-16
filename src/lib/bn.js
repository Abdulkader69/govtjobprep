const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Render a number in Bengali digits. Pass through non-digits untouched. */
export function bn(value) {
  return String(value)
    .split("")
    .map((c) => (c >= "0" && c <= "9" ? BN_DIGITS[Number(c)] : c))
    .join("");
}

/** mm:ss, always two digits. Bengali digits are optional because the exam
 *  clock is easier to scan in Latin numerals on a small screen. */
export function clock(seconds, bengali = false) {
  const s = Math.max(0, Math.round(seconds));
  const out = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return bengali ? bn(out) : out;
}

/** Drop a trailing .00 so whole scores read as "42" not "42.00". */
export function mark(value) {
  return bn(Number(value).toFixed(2).replace(/\.00$/, ""));
}

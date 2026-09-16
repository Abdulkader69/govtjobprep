import { useEffect, useState } from "react";

/** Questions shown at once on a wide screen. */
export const DESKTOP_PER_PAGE = 5;

/** The width at which five questions stop being comfortable to scan. */
const WIDE = "(min-width: 768px)";

/**
 * Snap a question index to the first question of the page containing it.
 *
 * Used both when navigating and when the breakpoint changes mid-exam: rotating
 * a phone must not drop the candidate on an unrelated question.
 */
export function pageStart(index, perPage, total = Infinity) {
  const safe = Math.max(0, Math.min(index, Math.max(0, total - 1)));
  const size = Math.max(1, perPage);
  return Math.floor(safe / size) * size;
}

/**
 * How many questions to show per page.
 *
 * Five on a wide screen so a candidate can see a block at a time the way a
 * printed paper reads; one on a phone, where five stacked questions means
 * scrolling past three screens to reach the next button.
 *
 * Driven by matchMedia rather than a resize listener so it also reacts to a
 * phone being rotated mid-exam.
 */
export function usePerPage() {
  const [perPage, setPerPage] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return DESKTOP_PER_PAGE;
    return window.matchMedia(WIDE).matches ? DESKTOP_PER_PAGE : 1;
  });

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(WIDE);
    const sync = () => setPerPage(mq.matches ? DESKTOP_PER_PAGE : 1);
    sync();
    // addEventListener on MediaQueryList is the modern form; older WebKit on
    // cheap Android phones still only has addListener.
    if (mq.addEventListener) {
      mq.addEventListener("change", sync);
      return () => mq.removeEventListener("change", sync);
    }
    mq.addListener(sync);
    return () => mq.removeListener(sync);
  }, []);

  return perPage;
}

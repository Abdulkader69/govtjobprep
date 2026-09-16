import { useState } from "react";
import { isBookmarked, toggleBookmark } from "@/lib/bookmarks.js";

/**
 * Flag a question to revisit.
 *
 * `onChange` lets a filtered list (the saved-only view) drop the row when it is
 * un-saved, instead of leaving a question on screen that no longer belongs there.
 */
export default function BookmarkButton({ id, onChange }) {
  const [saved, setSaved] = useState(() => isBookmarked(id));

  return (
    <button
      type="button"
      className="bookmark"
      aria-pressed={saved}
      aria-label={saved ? "সংরক্ষণ থেকে সরান" : "পরে দেখার জন্য রাখুন"}
      title={saved ? "সংরক্ষিত" : "পরে দেখব"}
      onClick={() => {
        const next = toggleBookmark(id);
        setSaved(next);
        onChange?.(id, next);
      }}
    >
      <span aria-hidden="true">{saved ? "★" : "☆"}</span>
      <span className="bookmark-label">{saved ? "সংরক্ষিত" : "পরে দেখব"}</span>
    </button>
  );
}

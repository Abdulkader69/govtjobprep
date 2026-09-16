const KEY = "bdje.saved";

/**
 * Questions the candidate flagged to come back to.
 *
 * Ids only, same reasoning as the history store: the bank already holds the
 * text, and duplicating it would exhaust the quota. Order is insertion order,
 * so the list reads newest-last the way a notebook would.
 */

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function write(ids) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
    return true;
  } catch {
    return false;
  }
}

export function listBookmarks() {
  return read();
}

export function bookmarkSet() {
  return new Set(read());
}

export function isBookmarked(id) {
  return read().includes(id);
}

/** @returns {boolean} whether the question is bookmarked after the toggle */
export function toggleBookmark(id) {
  const ids = read();
  const at = ids.indexOf(id);
  if (at === -1) {
    ids.push(id);
    write(ids);
    return true;
  }
  ids.splice(at, 1);
  write(ids);
  return false;
}

export function clearBookmarks() {
  try {
    localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

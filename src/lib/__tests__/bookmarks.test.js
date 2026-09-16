import { describe, it, expect, beforeEach } from "vitest";
import {
  listBookmarks, bookmarkSet, isBookmarked, toggleBookmark, clearBookmarks,
} from "../bookmarks.js";

beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

describe("bookmarks", () => {
  it("starts empty", () => {
    expect(listBookmarks()).toEqual([]);
    expect(isBookmarked("q1")).toBe(false);
  });

  it("toggles on and off, reporting the resulting state", () => {
    expect(toggleBookmark("q1")).toBe(true);
    expect(isBookmarked("q1")).toBe(true);
    expect(toggleBookmark("q1")).toBe(false);
    expect(isBookmarked("q1")).toBe(false);
  });

  it("keeps insertion order", () => {
    toggleBookmark("q3");
    toggleBookmark("q1");
    toggleBookmark("q2");
    expect(listBookmarks()).toEqual(["q3", "q1", "q2"]);
  });

  it("does not duplicate on repeated saves", () => {
    toggleBookmark("q1");
    toggleBookmark("q1");
    toggleBookmark("q1");
    expect(listBookmarks()).toEqual(["q1"]);
  });

  it("exposes a Set for filtering a long list cheaply", () => {
    toggleBookmark("q1");
    toggleBookmark("q2");
    const set = bookmarkSet();
    expect(set.has("q1")).toBe(true);
    expect(set.has("q9")).toBe(false);
  });

  it("clears", () => {
    toggleBookmark("q1");
    clearBookmarks();
    expect(listBookmarks()).toEqual([]);
  });

  it("treats corrupt storage as empty rather than crashing", () => {
    localStorage.setItem("bdje.saved", "{not json");
    expect(listBookmarks()).toEqual([]);
  });

  it("ignores non-string entries that somehow got stored", () => {
    localStorage.setItem("bdje.saved", JSON.stringify(["q1", 42, null, "q2"]));
    expect(listBookmarks()).toEqual(["q1", "q2"]);
  });
});

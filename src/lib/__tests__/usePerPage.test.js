import { describe, it, expect } from "vitest";
import { pageStart, DESKTOP_PER_PAGE } from "../usePerPage.js";

describe("pageStart", () => {
  it("snaps to the first question of the containing page", () => {
    expect(pageStart(0, 5)).toBe(0);
    expect(pageStart(4, 5)).toBe(0);
    expect(pageStart(5, 5)).toBe(5);
    expect(pageStart(22, 5)).toBe(20);
  });

  it("is the identity when one question is shown at a time", () => {
    for (const i of [0, 1, 17, 39]) expect(pageStart(i, 1)).toBe(i);
  });

  it("keeps a candidate near where they were when the layout changes", () => {
    // Question 23 on a phone, then the phone is rotated to a wide layout.
    const onPhone = 22;
    expect(pageStart(onPhone, DESKTOP_PER_PAGE)).toBe(20);
    // ...and back again: still on the same page, not thrown to the start.
    expect(pageStart(20, 1)).toBe(20);
  });

  it("never runs past the end of the paper", () => {
    expect(pageStart(99, 5, 40)).toBe(35);
    expect(pageStart(40, 5, 40)).toBe(35);
  });

  it("clamps a negative index rather than producing a negative page", () => {
    expect(pageStart(-3, 5)).toBe(0);
  });

  it("survives a nonsense page size instead of dividing by zero", () => {
    expect(pageStart(7, 0)).toBe(7);
    expect(Number.isFinite(pageStart(7, 0))).toBe(true);
  });

  it("handles an empty paper", () => {
    expect(pageStart(0, 5, 0)).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { explanationLines } from "../explanation.js";

describe("explanationLines", () => {
  it("turns a chain of equalities into one step per line", () => {
    expect(explanationLines("a² + b² = (a + b)² − 2ab = ৪৯ − ২০ = ২৯।", "math")).toEqual([
      "a² + b²",
      "= (a + b)² − 2ab",
      "= ৪৯ − ২০",
      "= ২৯।",
    ]);
  });

  it("gives each maths sentence its own line, splitting only real chains", () => {
    expect(
      explanationLines("দুই সংখ্যার গুণফল = গ.সা.গু × ল.সা.গু = ৬ × ৩৬ = ২১৬। অপর সংখ্যা = ২১৬ ÷ ১২ = ১৮।", "math")
    ).toEqual(["দুই সংখ্যার গুণফল", "= গ.সা.গু × ল.সা.গু", "= ৬ × ৩৬", "= ২১৬।", "অপর সংখ্যা", "= ২১৬ ÷ ১২", "= ১৮।"]);
  });

  it("leaves a sentence with several statements whole", () => {
    expect(explanationLines("১২ = ২²×৩, ১৮ = ২×৩², ২৪ = ২³×৩। ল.সা.গু = ২³×৩² = ৭২।", "math")).toEqual([
      "১২ = ২²×৩, ১৮ = ২×৩², ২৪ = ২³×৩।",
      "ল.সা.গু",
      "= ২³×৩²",
      "= ৭২।",
    ]);
    expect(explanationLines("x = ৫ এবং y = ৩ হলে x + y = ৮।", "math")).toEqual(["x = ৫ এবং y = ৩ হলে x + y = ৮।"]);
  });

  it("does not touch a single equality", () => {
    expect(explanationLines("গড় = ১৫ ÷ ৫।", "math")).toEqual(["গড় = ১৫ ÷ ৫।"]);
  });

  it("keeps prose subjects as written, but honours explicit newlines everywhere", () => {
    expect(explanationLines("সন্ধি = দুই বর্ণের মিলন = একটি শব্দ = ঠিক।", "bangla")).toEqual(["সন্ধি = দুই বর্ণের মিলন = একটি শব্দ = ঠিক।"]);
    expect(explanationLines("প্রথম লাইন।\nদ্বিতীয় লাইন।", "gk")).toEqual(["প্রথম লাইন।", "দ্বিতীয় লাইন।"]);
    expect(explanationLines("", "math")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  combinationFits,
  editionById,
  EDITIONS,
  playableEditions,
} from "./edition.ts";

describe("2-0:BATTLE", () => {
  const edition = editionById("2-0:BATTLE");

  it("renders its edition id exactly as `2-0:BATTLE`", () => {
    expect(edition.id).toBe("2-0:BATTLE");
  });

  it("pairs the standard_144 board layout with the standard_battle army composition", () => {
    expect(edition.boardLayoutId).toBe("standard_144");
    expect(edition.armyCompositionId).toBe("standard_battle");
    expect(edition.boardLayout.id).toBe("standard_144");
    expect(edition.army).toBe(EDITIONS["2-0:BATTLE"].army);
  });
});

describe("2-0:SKIRMISH", () => {
  const edition = editionById("2-0:SKIRMISH");

  it("renders its edition id exactly as `2-0:SKIRMISH`", () => {
    expect(edition.id).toBe("2-0:SKIRMISH");
  });

  it("pairs the standard_64 board layout with the standard_skirmish army composition", () => {
    expect(edition.boardLayoutId).toBe("standard_64");
    expect(edition.armyCompositionId).toBe("standard_skirmish");
    expect(edition.boardLayout.id).toBe("standard_64");
  });
});

describe("combinationFits (does an army fit a board's home zone)", () => {
  it("accepts the two published editions", () => {
    expect(combinationFits("standard_144", "standard_battle")).toBe(true);
    expect(combinationFits("standard_64", "standard_skirmish")).toBe(true);
  });

  it("rejects the 25-piece Battle army on the 24-square Skirmish home zone", () => {
    expect(combinationFits("standard_64", "standard_battle")).toBe(false);
  });
});

describe("playableEditions", () => {
  it("offers exactly the two published editions for play", () => {
    const ids = playableEditions()
      .map((edition) => edition.id)
      .sort();
    expect(ids).toEqual(["2-0:BATTLE", "2-0:SKIRMISH"]);
  });
});

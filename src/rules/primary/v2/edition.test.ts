import { describe, expect, it } from "vitest";
import {
  BATTLE_EDITION,
  combinationFits,
  editionById,
  EDITIONS,
  playableEditions,
  SKIRMISH_EDITION,
  SUPERSEDED_SKIRMISH_EDITION,
} from "./edition.ts";

describe("2-0:BATTLE", () => {
  const edition = editionById("2-0:BATTLE");

  it("renders its edition id exactly as `2-0:BATTLE`", () => {
    expect(edition.id).toBe("2-0:BATTLE");
  });

  it("pairs the standard_144 board layout with the standard_battle army composition", () => {
    expect(edition.boardLayoutId).toBe("standard_144");
    expect(edition.armyCompositionId).toBe("standard_battle");
  });

  it("is active, with spacing_only Tower placement", () => {
    expect(edition.status).toBe("active");
    expect(edition.towerPlacement).toBe("spacing_only");
  });
});

describe("2-1:SKIRMISH (the active Skirmish edition)", () => {
  const edition = editionById("2-1:SKIRMISH");

  it("renders its edition id exactly as `2-1:SKIRMISH`", () => {
    expect(edition.id).toBe("2-1:SKIRMISH");
  });

  it("pairs the standard_64 board layout with the standard_skirmish army composition", () => {
    expect(edition.boardLayoutId).toBe("standard_64");
    expect(edition.armyCompositionId).toBe("standard_skirmish");
  });

  it("is active, with spacing_and_lanes Tower placement", () => {
    expect(edition.status).toBe("active");
    expect(edition.towerPlacement).toBe("spacing_and_lanes");
  });
});

describe("2-0:SKIRMISH (the superseded Skirmish edition)", () => {
  const edition = editionById("2-0:SKIRMISH");

  it("renders its edition id exactly as `2-0:SKIRMISH`, and is reachable as SUPERSEDED_SKIRMISH_EDITION", () => {
    expect(edition.id).toBe("2-0:SKIRMISH");
    expect(edition).toBe(SUPERSEDED_SKIRMISH_EDITION);
  });

  it("shares 2-1:SKIRMISH's board layout and army composition", () => {
    expect(edition.boardLayoutId).toBe("standard_64");
    expect(edition.armyCompositionId).toBe("standard_skirmish");
  });

  it("is superseded, with spacing_only Tower placement (towers were allowed in front of a lane)", () => {
    expect(edition.status).toBe("superseded");
    expect(edition.towerPlacement).toBe("spacing_only");
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
  it("offers exactly the two active editions for play, never the superseded one", () => {
    const ids = playableEditions()
      .map((edition) => edition.id)
      .sort();
    expect(ids).toEqual(["2-0:BATTLE", "2-1:SKIRMISH"]);
  });
});

// Story 00000030's implementation plan, Decision 1 and Step 4 verification:
// `Edition` no longer carries a resolved board or roster at all - only the
// three registered `Edition` objects, `EDITIONS`, `BATTLE_EDITION` and
// `SKIRMISH_EDITION` names them all. `RuleConfiguration.boardLayout`/`.army`
// (`configuration.ts`) are the only place a board or a roster comes from now.
describe("no Edition object carries a resolved board or roster any more", () => {
  it.each([
    ["BATTLE_EDITION", BATTLE_EDITION],
    ["SKIRMISH_EDITION", SKIRMISH_EDITION],
    ["SUPERSEDED_SKIRMISH_EDITION", SUPERSEDED_SKIRMISH_EDITION],
    ...Object.entries(EDITIONS),
  ] as const)(
    "%s has neither a boardLayout nor an army field",
    (_name, edition) => {
      expect(Object.hasOwn(edition, "boardLayout")).toBe(false);
      expect(Object.hasOwn(edition, "army")).toBe(false);
    },
  );
});

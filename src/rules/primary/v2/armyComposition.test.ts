import { describe, expect, it } from "vitest";
import { ARMY_COMPOSITIONS, armySize } from "./armyComposition.ts";
import { PIECE_TYPES } from "./pieces.ts";

describe("standard_battle (Battle army composition)", () => {
  const roster = ARMY_COMPOSITIONS.standard_battle.roster;

  it("keys itself by its own id", () => {
    expect(ARMY_COMPOSITIONS.standard_battle.id).toBe("standard_battle");
  });

  it("fields every piece type", () => {
    for (const id of PIECE_TYPES) {
      expect(roster[id]).toBeGreaterThan(0);
    }
  });

  it("totals 25 pieces per side, unchanged from major 1", () => {
    expect(armySize(roster)).toBe(25);
  });
});

describe("standard_skirmish (Skirmish army composition)", () => {
  const roster = ARMY_COMPOSITIONS.standard_skirmish.roster;

  it("keys itself by its own id", () => {
    expect(ARMY_COMPOSITIONS.standard_skirmish.id).toBe("standard_skirmish");
  });

  it("totals 16 pieces per side", () => {
    expect(armySize(roster)).toBe(16);
  });

  it("fields three each of ranks 1-4, three Towers, and one Flag", () => {
    expect(roster.masterOfArms).toBe(3);
    expect(roster.champion).toBe(3);
    expect(roster.knight).toBe(3);
    expect(roster.halberdier).toBe(3);
    expect(roster.tower).toBe(3);
    expect(roster.flag).toBe(1);
  });

  it("fields no Foot Soldier or Militia (ranks 5 and 6)", () => {
    expect(roster.footSoldier).toBe(0);
    expect(roster.militia).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  ARMY_COMPOSITIONS,
  armySize,
  BATTLE_ARMY,
  freshInventory,
} from "./armyComposition.ts";
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

describe("BATTLE_ARMY", () => {
  it("is Battle's roster (the live app's, and placement.ts's, default)", () => {
    expect(BATTLE_ARMY).toBe(ARMY_COMPOSITIONS.standard_battle.roster);
    expect(armySize(BATTLE_ARMY)).toBe(25);
  });
});

describe("freshInventory", () => {
  it("returns a fresh Battle inventory with every type at its full quantity", () => {
    const inventory = freshInventory(BATTLE_ARMY);
    for (const id of PIECE_TYPES) {
      expect(inventory[id]).toBe(BATTLE_ARMY[id]);
    }
    expect(armySize(BATTLE_ARMY)).toBe(25);
  });

  it("returns a fresh 16-piece Skirmish inventory with the right per-type counts and no rank 5/6", () => {
    const roster = ARMY_COMPOSITIONS.standard_skirmish.roster;
    const inventory = freshInventory(roster);

    expect(armySize(roster)).toBe(16);
    expect(inventory.masterOfArms).toBe(3);
    expect(inventory.champion).toBe(3);
    expect(inventory.knight).toBe(3);
    expect(inventory.halberdier).toBe(3);
    expect(inventory.tower).toBe(3);
    expect(inventory.flag).toBe(1);
    expect(inventory.footSoldier).toBe(0);
    expect(inventory.militia).toBe(0);

    const total = PIECE_TYPES.reduce((sum, id) => sum + inventory[id], 0);
    expect(total).toBe(16);
  });

  it("returns a fresh object each call (not a shared mutable reference)", () => {
    const first = freshInventory(BATTLE_ARMY);
    const second = freshInventory(BATTLE_ARMY);
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(first).not.toBe(BATTLE_ARMY);
  });
});

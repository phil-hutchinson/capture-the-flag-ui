import { describe, expect, it } from "vitest";
import {
  ARMY_SIZE,
  freshInventory,
  PIECE_CATALOG,
  PIECE_TYPES,
  pieceCatalogEntries,
  type PieceTypeId,
} from "./pieces.ts";

// Source: doc/plan/00000016-update-to-rules-1.2/implementation-plan.md
// "Grounding facts" table, resolved against rules.md §2.2 (ruleset
// 1.2:PRE-RELEASE): three each of six ranked pieces, six Towers, one Flag.
const EXPECTED_QUANTITIES: Record<PieceTypeId, number> = {
  masterOfArms: 3,
  champion: 3,
  knight: 3,
  halberdier: 3,
  footSoldier: 3,
  militia: 3,
  tower: 6,
  flag: 1,
};

describe("piece catalog (ruleset 1.2:PRE-RELEASE)", () => {
  it("has exactly 8 piece types", () => {
    expect(PIECE_TYPES).toHaveLength(8);
    expect(pieceCatalogEntries()).toHaveLength(8);
  });

  it("matches the ruleset's per-type quantity for every piece", () => {
    for (const [id, expectedQuantity] of Object.entries(
      EXPECTED_QUANTITIES,
    ) as [PieceTypeId, number][]) {
      expect(PIECE_CATALOG[id].quantityPerSide).toBe(expectedQuantity);
    }
  });

  it("sums to exactly 25 pieces per side", () => {
    const total = pieceCatalogEntries().reduce(
      (sum, entry) => sum + entry.quantityPerSide,
      0,
    );
    expect(total).toBe(25);
    expect(ARMY_SIZE).toBe(25);
  });

  it("gives every piece type a distinct position-block symbol", () => {
    const symbols = pieceCatalogEntries().map((entry) => entry.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it("uses only the 1-6/T/F symbol set", () => {
    const symbols = pieceCatalogEntries()
      .map((entry) => entry.symbol)
      .sort();
    expect(symbols).toEqual(["1", "2", "3", "4", "5", "6", "F", "T"].sort());
  });

  it("gives every ranked piece type a distinct rank code, 1 through 6", () => {
    // Tower and Flag are unranked (rankCode: null) - both lacking a rank is
    // not the same as sharing one, so distinctness is only required among
    // the pieces that do carry a rank code.
    const rankedEntries = pieceCatalogEntries().filter(
      (entry) => entry.rankCode !== null,
    );
    const rankCodes = rankedEntries.map((entry) => entry.rankCode);
    expect(new Set(rankCodes).size).toBe(rankCodes.length);
    expect([...rankCodes].sort()).toEqual([1, 2, 3, 4, 5, 6]);

    // Exactly Tower and Flag are unranked.
    const unranked = pieceCatalogEntries()
      .filter((entry) => entry.rankCode === null)
      .map((entry) => entry.id)
      .sort();
    expect(unranked).toEqual(["flag", "tower"]);
  });

  it("gives every piece type a non-empty player-facing display name", () => {
    for (const entry of pieceCatalogEntries()) {
      expect(entry.displayName.length).toBeGreaterThan(0);
    }
  });

  it("spells the display names exactly as the rules do", () => {
    expect(PIECE_CATALOG.masterOfArms.displayName).toBe("Master-of-Arms");
    expect(PIECE_CATALOG.champion.displayName).toBe("Champion");
    expect(PIECE_CATALOG.knight.displayName).toBe("Knight");
    expect(PIECE_CATALOG.halberdier.displayName).toBe("Halberdier");
    expect(PIECE_CATALOG.footSoldier.displayName).toBe("Foot Soldier");
    expect(PIECE_CATALOG.militia.displayName).toBe("Militia");
    expect(PIECE_CATALOG.tower.displayName).toBe("Tower");
    expect(PIECE_CATALOG.flag.displayName).toBe("Flag");
  });

  it("keys PIECE_CATALOG entries by their own id", () => {
    for (const id of PIECE_TYPES) {
      expect(PIECE_CATALOG[id].id).toBe(id);
    }
  });
});

describe("freshInventory (ruleset 1.2:PRE-RELEASE)", () => {
  it("returns a full 25-piece army with every type at its full quantity", () => {
    const inventory = freshInventory();
    for (const id of PIECE_TYPES) {
      expect(inventory[id]).toBe(PIECE_CATALOG[id].quantityPerSide);
    }
    const total = PIECE_TYPES.reduce((sum, id) => sum + inventory[id], 0);
    expect(total).toBe(25);
  });

  it("returns a fresh object each call (not a shared mutable reference)", () => {
    const first = freshInventory();
    const second = freshInventory();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});

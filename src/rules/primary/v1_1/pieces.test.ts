import { describe, expect, it } from "vitest";
import {
  ARMY_SIZE,
  freshInventory,
  PIECE_CATALOG,
  PIECE_TYPES,
  pieceCatalogEntries,
  type PieceTypeId,
} from "./pieces.ts";

// Source: doc/plan/00000001-create-board-layout-tool/implementation-plan.md
// "Grounding facts" table, resolved against rules.md §2.2 (ruleset PRIMARY:1.1).
const EXPECTED_QUANTITIES: Record<PieceTypeId, number> = {
  lordMarshal: 1,
  champion: 2,
  knight: 4,
  infantry: 4,
  halberdier: 6,
  militia: 6,
  skirmisher: 6,
  archer: 3,
  sapper: 8,
  assassin: 1,
  tower: 6,
  flag: 1,
};

describe("piece catalog (ruleset PRIMARY:1.1)", () => {
  it("has exactly 12 piece types", () => {
    expect(PIECE_TYPES).toHaveLength(12);
    expect(pieceCatalogEntries()).toHaveLength(12);
  });

  it("matches the ruleset's per-type quantity for every piece", () => {
    for (const [id, expectedQuantity] of Object.entries(
      EXPECTED_QUANTITIES,
    ) as [PieceTypeId, number][]) {
      expect(PIECE_CATALOG[id].quantityPerSide).toBe(expectedQuantity);
    }
  });

  it("sums to exactly 48 pieces per side", () => {
    const total = pieceCatalogEntries().reduce(
      (sum, entry) => sum + entry.quantityPerSide,
      0,
    );
    expect(total).toBe(48);
    expect(ARMY_SIZE).toBe(48);
  });

  it("gives every piece type a distinct position-block symbol", () => {
    const symbols = pieceCatalogEntries().map((entry) => entry.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it("gives every ranked piece type a distinct rank code", () => {
    // Tower and Flag are unranked (rankCode: null) - both lacking a rank is
    // not the same as sharing one, so distinctness is only required among
    // the pieces that do carry a rank code.
    const rankedEntries = pieceCatalogEntries().filter(
      (entry) => entry.rankCode !== null,
    );
    const rankCodes = rankedEntries.map((entry) => entry.rankCode);
    expect(new Set(rankCodes).size).toBe(rankCodes.length);

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

  it("keys PIECE_CATALOG entries by their own id", () => {
    for (const id of PIECE_TYPES) {
      expect(PIECE_CATALOG[id].id).toBe(id);
    }
  });
});

describe("freshInventory (ruleset PRIMARY:1.1)", () => {
  it("returns a full 48-piece army with every type at its full quantity", () => {
    const inventory = freshInventory();
    for (const id of PIECE_TYPES) {
      expect(inventory[id]).toBe(PIECE_CATALOG[id].quantityPerSide);
    }
    const total = PIECE_TYPES.reduce((sum, id) => sum + inventory[id], 0);
    expect(total).toBe(48);
  });

  it("returns a fresh object each call (not a shared mutable reference)", () => {
    const first = freshInventory();
    const second = freshInventory();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});

import { describe, expect, it } from "vitest";
import {
  ARMY_SIZE,
  FLAG_DISPLAY_NAME,
  FLAG_ID_DIGIT,
  FLAG_QUANTITY_PER_SIDE,
  NUMBERED_PIECE_COUNT_PER_SIDE,
  RANK_CATALOG,
  RANKS,
  rankCatalogEntries,
} from "./pieces.ts";

describe("piece catalog (ruleset major 3)", () => {
  it("totals 16 pieces per army: 15 numbered pieces and 1 Flag", () => {
    expect(NUMBERED_PIECE_COUNT_PER_SIDE).toBe(15);
    expect(FLAG_QUANTITY_PER_SIDE).toBe(1);
    expect(ARMY_SIZE).toBe(16);
  });

  it("has exactly three of each of the five ranks", () => {
    for (const rank of RANKS) {
      expect(RANK_CATALOG[rank].quantityPerSide).toBe(3);
    }
    expect(RANKS).toHaveLength(5);
  });

  it("names rank 5 Master-of-Arms (strongest) and rank 1 Peasant (weakest)", () => {
    expect(RANK_CATALOG[5].displayName).toBe("Master-of-Arms");
    expect(RANK_CATALOG[1].displayName).toBe("Peasant");
  });

  it("names every rank as rules.md §2.2 does", () => {
    expect(RANK_CATALOG[4].displayName).toBe("Champion");
    expect(RANK_CATALOG[3].displayName).toBe("Foot Soldier");
    expect(RANK_CATALOG[2].displayName).toBe("Militia");
  });

  it("gives each rank an id digit equal to its own number", () => {
    for (const rank of RANKS) {
      expect(RANK_CATALOG[rank].idDigit).toBe(String(rank));
    }
  });

  it("gives the Flag its own id digit, distinct from every rank digit", () => {
    expect(FLAG_ID_DIGIT).toBe("F");
    expect(FLAG_DISPLAY_NAME).toBe("Flag");
    for (const rank of RANKS) {
      expect(RANK_CATALOG[rank].idDigit).not.toBe(FLAG_ID_DIGIT);
    }
  });

  it("lists the catalog strongest-first, matching rules.md §2.2's table order", () => {
    expect(rankCatalogEntries().map((entry) => entry.rank)).toEqual([
      5, 4, 3, 2, 1,
    ]);
  });
});

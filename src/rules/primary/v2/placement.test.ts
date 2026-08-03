import { describe, expect, it } from "vitest";
import {
  ARMY_COMPOSITIONS,
  armySize,
  BATTLE_ARMY,
  type ArmyRoster,
} from "./armyComposition.ts";
import {
  BATTLE_LAYOUT,
  homeSquares,
  isHomeSquareFor,
  type Square,
} from "./board.ts";
import { BOARD_LAYOUTS } from "./boardLayout.ts";
import {
  pieceCatalogEntries,
  PIECE_TYPES,
  type PieceTypeId,
} from "./pieces.ts";
import {
  autoFill,
  clear,
  emptyPlacement,
  isComplete,
  move,
  pieceAt,
  place,
  placedCount,
  progress,
  remainingCount,
  returnToTray,
  swap,
  towersLegallyPlaced,
  type PlacementState,
  type RandomSource,
} from "./placement.ts";

/** Battle's own army size (25) - the roster these Battle fixtures place. */
const ARMY_SIZE = armySize(BATTLE_ARMY);

const WHITE_HOME: readonly Square[] = homeSquares("white");
const BLACK_HOME: readonly Square[] = homeSquares("black");
const NON_HOME_SQUARES: readonly Square[] = [
  { column: "A", row: 5 }, // buffer
  { column: "B", row: 6 }, // lake
  { column: "A", row: 9 }, // opponent's (Black's) zone, from White's perspective
];

/** True if `a` and `b` are the same square or orthogonally/diagonally adjacent. */
function adjacentOrSame(a: Square, b: Square): boolean {
  const columns = "ABCDEFGHIJKL";
  const columnDelta = Math.abs(
    columns.indexOf(a.column) - columns.indexOf(b.column),
  );
  const rowDelta = Math.abs(a.row - b.row);
  return columnDelta <= 1 && rowDelta <= 1;
}

/** Fills every one of `state.side`'s 25-piece army onto its first 25 home squares (in `homeSquares` order). */
function placeFullArmy(state: PlacementState): PlacementState {
  const squares = homeSquares(state.side);
  let index = 0;
  let result = state;
  for (const entry of pieceCatalogEntries()) {
    for (let i = 0; i < entry.quantityPerSide; i += 1) {
      result = place(result, squares[index], entry.id);
      index += 1;
    }
  }
  return result;
}

describe("emptyPlacement (ruleset major 2)", () => {
  it("starts with no pieces placed and a full 25-piece tray", () => {
    const state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    expect(placedCount(state)).toBe(0);
    expect(isComplete(state)).toBe(false);
    for (const entry of pieceCatalogEntries()) {
      expect(remainingCount(state, entry.id)).toBe(entry.quantityPerSide);
    }
  });
});

describe("place", () => {
  it("occupies the square and decrements remaining", () => {
    const state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    const square = WHITE_HOME[0];
    const next = place(state, square, "champion");

    expect(pieceAt(next, square)).toBe("champion");
    expect(remainingCount(next, "champion")).toBe(2); // was 3
    expect(placedCount(next)).toBe(1);
    // The original state is untouched (immutable-style operations).
    expect(pieceAt(state, square)).toBeUndefined();
    expect(remainingCount(state, "champion")).toBe(3);
  });

  it("rejects placing on a square that is not the side's own home square", () => {
    const state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    for (const square of NON_HOME_SQUARES) {
      expect(() => place(state, square, "militia")).toThrow();
    }
    // Black's home squares are not White's home squares either.
    expect(() => place(state, BLACK_HOME[0], "militia")).toThrow();
  });

  it("rejects placing on an already-occupied square", () => {
    const state = place(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY),
      WHITE_HOME[0],
      "knight",
    );
    expect(() => place(state, WHITE_HOME[0], "militia")).toThrow();
  });

  it("rejects placing a piece type with zero remaining", () => {
    let state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    // Flag has quantity 1: place it once, then a second placement must fail.
    state = place(state, WHITE_HOME[0], "flag");
    expect(() => place(state, WHITE_HOME[1], "flag")).toThrow();
  });
});

describe("move", () => {
  it("relocates a placed piece without changing remaining counts", () => {
    const from = WHITE_HOME[0];
    const to = WHITE_HOME[1];
    const before = place(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY),
      from,
      "knight",
    );
    const after = move(before, from, to);

    expect(pieceAt(after, from)).toBeUndefined();
    expect(pieceAt(after, to)).toBe("knight");
    expect(placedCount(after)).toBe(1);
    expect(remainingCount(after, "knight")).toBe(
      remainingCount(before, "knight"),
    );
  });

  it("rejects moving from an empty square", () => {
    const state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    expect(() => move(state, WHITE_HOME[0], WHITE_HOME[1])).toThrow();
  });

  it("rejects moving onto an already-occupied square", () => {
    let state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    state = place(state, WHITE_HOME[0], "champion");
    state = place(state, WHITE_HOME[1], "knight");
    expect(() => move(state, WHITE_HOME[0], WHITE_HOME[1])).toThrow();
  });

  it("rejects moving to or from a non-home square", () => {
    const state = place(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY),
      WHITE_HOME[0],
      "champion",
    );
    expect(() => move(state, WHITE_HOME[0], NON_HOME_SQUARES[1])).toThrow();
    expect(() => move(state, NON_HOME_SQUARES[0], WHITE_HOME[0])).toThrow();
  });
});

describe("swap", () => {
  it("exchanges two placed pieces and preserves remaining counts", () => {
    const squareA = WHITE_HOME[0];
    const squareB = WHITE_HOME[1];
    let state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    state = place(state, squareA, "champion");
    state = place(state, squareB, "knight");
    const before = state;

    const after = swap(state, squareA, squareB);

    expect(pieceAt(after, squareA)).toBe("knight");
    expect(pieceAt(after, squareB)).toBe("champion");
    expect(placedCount(after)).toBe(2);
    expect(remainingCount(after, "champion")).toBe(
      remainingCount(before, "champion"),
    );
    expect(remainingCount(after, "knight")).toBe(
      remainingCount(before, "knight"),
    );
  });

  it("rejects swapping when either square is empty", () => {
    const state = place(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY),
      WHITE_HOME[0],
      "champion",
    );
    expect(() => swap(state, WHITE_HOME[0], WHITE_HOME[1])).toThrow();
  });

  it("rejects swapping a non-home square", () => {
    let state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    state = place(state, WHITE_HOME[0], "champion");
    state = place(state, WHITE_HOME[1], "knight");
    expect(() => swap(state, WHITE_HOME[0], NON_HOME_SQUARES[1])).toThrow();
  });
});

describe("returnToTray", () => {
  it("empties the square and increments remaining", () => {
    const square = WHITE_HOME[0];
    const placed = place(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY),
      square,
      "tower",
    );
    const after = returnToTray(placed, square);

    expect(pieceAt(after, square)).toBeUndefined();
    expect(placedCount(after)).toBe(0);
    expect(remainingCount(after, "tower")).toBe(6);
  });

  it("rejects returning from an empty square", () => {
    const state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    expect(() => returnToTray(state, WHITE_HOME[0])).toThrow();
  });

  it("rejects returning from a non-home square", () => {
    const state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    expect(() => returnToTray(state, NON_HOME_SQUARES[1])).toThrow();
  });
});

describe("clear", () => {
  it("empties the board and restores the full 25-count inventory", () => {
    const full = placeFullArmy(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY),
    );
    expect(isComplete(full)).toBe(true);

    const cleared = clear(full);
    expect(placedCount(cleared)).toBe(0);
    for (const entry of pieceCatalogEntries()) {
      expect(remainingCount(cleared, entry.id)).toBe(entry.quantityPerSide);
    }
    for (const square of WHITE_HOME) {
      expect(pieceAt(cleared, square)).toBeUndefined();
    }
  });
});

describe("progress and isComplete", () => {
  it("reports placed/total progress accurately as pieces are placed", () => {
    let state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    expect(progress(state)).toEqual({ placed: 0, total: ARMY_SIZE });

    state = place(state, WHITE_HOME[0], "militia");
    expect(progress(state)).toEqual({ placed: 1, total: ARMY_SIZE });

    state = place(state, WHITE_HOME[1], "militia");
    expect(progress(state)).toEqual({ placed: 2, total: ARMY_SIZE });
  });

  it("is complete only when all 25 pieces are placed, leaving the rest of the 48 home squares empty", () => {
    const state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    expect(isComplete(state)).toBe(false);

    const full = placeFullArmy(state);
    expect(placedCount(full)).toBe(ARMY_SIZE);
    expect(isComplete(full)).toBe(true);
    expect(progress(full)).toEqual({ placed: ARMY_SIZE, total: ARMY_SIZE });

    // 25 of the 48 home squares hold a piece; the rest are intentionally empty.
    const emptySquares = WHITE_HOME.filter(
      (square) => pieceAt(full, square) === undefined,
    );
    expect(emptySquares).toHaveLength(WHITE_HOME.length - ARMY_SIZE);

    // One short of a full army is not complete.
    const almost = returnToTray(full, WHITE_HOME[0]);
    expect(isComplete(almost)).toBe(false);
  });

  it("tracks each side's own home squares independently", () => {
    let state = emptyPlacement("black", BATTLE_LAYOUT, BATTLE_ARMY);
    state = place(state, BLACK_HOME[0], "knight");
    expect(pieceAt(state, BLACK_HOME[0])).toBe("knight");
    for (const square of WHITE_HOME) {
      expect(pieceAt(state, square)).toBeUndefined();
    }
  });
});

describe("towersLegallyPlaced", () => {
  it("is true with no Towers placed at all", () => {
    expect(
      towersLegallyPlaced(emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY)),
    ).toBe(true);
  });

  it("is true with a single Tower placed", () => {
    const state = place(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY),
      WHITE_HOME[0],
      "tower",
    );
    expect(towersLegallyPlaced(state)).toBe(true);
  });

  it("is true for two Towers that are not adjacent", () => {
    let state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    state = place(state, { column: "A", row: 1 }, "tower");
    state = place(state, { column: "D", row: 1 }, "tower");
    expect(towersLegallyPlaced(state)).toBe(true);
  });

  it("is false for two orthogonally adjacent Towers", () => {
    let state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    state = place(state, { column: "A", row: 1 }, "tower");
    state = place(state, { column: "B", row: 1 }, "tower");
    expect(towersLegallyPlaced(state)).toBe(false);
  });

  it("is false for two diagonally adjacent Towers", () => {
    let state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    state = place(state, { column: "A", row: 1 }, "tower");
    state = place(state, { column: "B", row: 2 }, "tower");
    expect(towersLegallyPlaced(state)).toBe(false);
  });

  it("catches a violation among more than two placed Towers", () => {
    let state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    state = place(state, { column: "A", row: 1 }, "tower");
    state = place(state, { column: "D", row: 1 }, "tower");
    state = place(state, { column: "D", row: 2 }, "tower"); // adjacent to D1
    expect(towersLegallyPlaced(state)).toBe(false);
  });

  it("tracks each side's own Towers independently", () => {
    let state = emptyPlacement("black", BATTLE_LAYOUT, BATTLE_ARMY);
    state = place(state, { column: "A", row: 9 }, "tower");
    state = place(state, { column: "B", row: 9 }, "tower");
    expect(towersLegallyPlaced(state)).toBe(false);
    expect(
      towersLegallyPlaced(emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY)),
    ).toBe(true);
  });
});

/**
 * A tiny seeded linear-congruential generator, used only so autoFill tests
 * can assert reproducibility with a fixed seed without depending on
 * `Math.random`.
 */
function seededRandom(seed: number): RandomSource {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

describe("autoFill", () => {
  it("from an empty board, places exactly ARMY_SIZE (25) pieces with a count-correct army", () => {
    const state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    const filled = autoFill(state, seededRandom(1));

    expect(isComplete(filled)).toBe(true);
    for (const entry of pieceCatalogEntries()) {
      expect(remainingCount(filled, entry.id)).toBe(0);
    }

    const counts = new Map<PieceTypeId, number>();
    let placedSquares = 0;
    for (const square of WHITE_HOME) {
      const type = pieceAt(filled, square);
      if (type !== undefined) {
        placedSquares += 1;
        expect(isHomeSquareFor(square, "white")).toBe(true);
        counts.set(type, (counts.get(type) ?? 0) + 1);
      }
    }
    expect(placedSquares).toBe(ARMY_SIZE);
    for (const entry of pieceCatalogEntries()) {
      expect(counts.get(entry.id)).toBe(entry.quantityPerSide);
    }
  });

  it("leaves the other 23 of the 48 home squares empty (placement is sparse, not a full-board fill)", () => {
    const filled = autoFill(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY),
      seededRandom(20),
    );
    const emptySquares = WHITE_HOME.filter(
      (square) => pieceAt(filled, square) === undefined,
    );
    expect(emptySquares).toHaveLength(WHITE_HOME.length - ARMY_SIZE);
  });

  it("never places two Towers adjacently, orthogonally or diagonally", () => {
    for (const seed of [1, 2, 3, 4, 5, 42, 100, 900]) {
      const filled = autoFill(
        emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY),
        seededRandom(seed),
      );
      expect(towersLegallyPlaced(filled)).toBe(true);

      const towerSquares = WHITE_HOME.filter(
        (square) => pieceAt(filled, square) === "tower",
      );
      expect(towerSquares).toHaveLength(6);
      for (let i = 0; i < towerSquares.length; i += 1) {
        for (let j = i + 1; j < towerSquares.length; j += 1) {
          expect(adjacentOrSame(towerSquares[i], towerSquares[j])).toBe(false);
        }
      }
    }
  });

  it("never places on a lake or buffer square", () => {
    const filled = autoFill(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY),
      seededRandom(2),
    );
    for (const square of NON_HOME_SQUARES) {
      expect(pieceAt(filled, square)).toBeUndefined();
    }
  });

  it("leaves already-placed pieces untouched and completes the army around them", () => {
    let state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    state = place(state, WHITE_HOME[0], "flag");
    state = place(state, WHITE_HOME[1], "masterOfArms");

    const filled = autoFill(state, seededRandom(3));

    expect(pieceAt(filled, WHITE_HOME[0])).toBe("flag");
    expect(pieceAt(filled, WHITE_HOME[1])).toBe("masterOfArms");
    expect(isComplete(filled)).toBe(true);
    for (const entry of pieceCatalogEntries()) {
      expect(remainingCount(filled, entry.id)).toBe(0);
    }
    expect(towersLegallyPlaced(filled)).toBe(true);
  });

  it("respects the Tower rule even when a Tower is already placed before autoFill runs", () => {
    const state = place(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY),
      WHITE_HOME[0],
      "tower",
    );
    for (const seed of [7, 8, 9]) {
      const filled = autoFill(state, seededRandom(seed));
      expect(pieceAt(filled, WHITE_HOME[0])).toBe("tower");
      expect(towersLegallyPlaced(filled)).toBe(true);
    }
  });

  it("is reproducible with a fixed seed", () => {
    const state = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    const first = autoFill(state, seededRandom(42));
    const second = autoFill(state, seededRandom(42));

    for (const square of WHITE_HOME) {
      expect(pieceAt(first, square)).toBe(pieceAt(second, square));
    }
  });

  it("tracks each side's own home squares independently", () => {
    const filled = autoFill(
      emptyPlacement("black", BATTLE_LAYOUT, BATTLE_ARMY),
      seededRandom(4),
    );
    expect(isComplete(filled)).toBe(true);
    for (const square of WHITE_HOME) {
      expect(pieceAt(filled, square)).toBeUndefined();
    }
  });
});

// Sanity check that the helper above is exercising a real, catalog-shaped army.
describe("placeFullArmy test helper", () => {
  it("places exactly ARMY_SIZE pieces using catalog quantities", () => {
    const full = placeFullArmy(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY),
    );
    const counts = new Map<PieceTypeId, number>();
    for (const square of WHITE_HOME) {
      const type = pieceAt(full, square);
      if (type !== undefined) {
        counts.set(type, (counts.get(type) ?? 0) + 1);
      }
    }
    for (const entry of pieceCatalogEntries()) {
      expect(counts.get(entry.id)).toBe(entry.quantityPerSide);
    }
  });
});

// Story 00000023, Step 3: home squares and the Tower-adjacency rule,
// exercised on the Skirmish layout (`standard_64`, 8x8) instead of Battle's
// own board (`BATTLE_LAYOUT`), to confirm `PlacementState`'s `boardLayout` is
// genuinely threaded through rather than hardcoding Battle's
// 12x12/48-home-square board. These deliberately keep the army out of it -
// only a couple of pieces are hand-placed, never `autoFill`'d to completion -
// so they isolate the board-layout threading from the army threading, which
// gets its own coverage below (story 00000023's Step 4). They still name
// Skirmish's own roster, since `emptyPlacement` requires one (peer review,
// finding #15) and Battle's 25 pieces would not fit this board's 24-square
// home zone.
describe("PlacementState on the Skirmish layout (8x8)", () => {
  const SKIRMISH = BOARD_LAYOUTS.standard_64;
  const SKIRMISH_ROSTER = ARMY_COMPOSITIONS.standard_skirmish.roster;

  it("emptyPlacement carries the given board layout", () => {
    const state = emptyPlacement("white", SKIRMISH, SKIRMISH_ROSTER);
    expect(state.boardLayout).toBe(SKIRMISH);
  });

  it("gives each side exactly 24 home squares, not Battle's 48", () => {
    expect(homeSquares("white", SKIRMISH)).toHaveLength(24);
    expect(homeSquares("black", SKIRMISH)).toHaveLength(24);
  });

  it("place/pieceAt work on a Skirmish home square", () => {
    const square: Square = { column: "D", row: 2 };
    const state = place(
      emptyPlacement("white", SKIRMISH, SKIRMISH_ROSTER),
      square,
      "knight",
    );
    expect(pieceAt(state, square)).toBe("knight");
  });

  it("rejects a square outside the Skirmish board's own home zone (row 9, on-board for Battle but not for Skirmish)", () => {
    const state = emptyPlacement("white", SKIRMISH, SKIRMISH_ROSTER);
    expect(() => place(state, { column: "A", row: 9 }, "knight")).toThrow();
  });

  it("clear() preserves the board layout", () => {
    const state = place(
      emptyPlacement("white", SKIRMISH, SKIRMISH_ROSTER),
      { column: "D", row: 2 },
      "knight",
    );
    const cleared = clear(state);
    expect(cleared.boardLayout).toBe(SKIRMISH);
    expect(placedCount(cleared)).toBe(0);
  });

  it("towersLegallyPlaced is true for two Towers that are not adjacent, near the Skirmish edge (H3, White's home corner)", () => {
    let state = emptyPlacement("white", SKIRMISH, SKIRMISH_ROSTER);
    state = place(state, { column: "H", row: 3 }, "tower");
    state = place(state, { column: "F", row: 3 }, "tower");
    expect(towersLegallyPlaced(state)).toBe(true);
  });

  it("towersLegallyPlaced is false for two Towers diagonally adjacent at the H3 corner", () => {
    let state = emptyPlacement("white", SKIRMISH, SKIRMISH_ROSTER);
    state = place(state, { column: "H", row: 3 }, "tower");
    state = place(state, { column: "G", row: 2 }, "tower");
    expect(towersLegallyPlaced(state)).toBe(false);
  });

  it("does not disturb Battle's own board layout", () => {
    expect(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY).boardLayout,
    ).not.toBe(SKIRMISH);
    expect(homeSquares("white")).toHaveLength(48);
  });
});

// Story 00000023, Step 4: the army roster/inventory threaded through
// `PlacementState`, exercised with Skirmish's real 16-piece roster
// (`standard_skirmish`) on the Skirmish layout - the combination that
// actually fits (unlike Battle's 25-piece roster on Skirmish's 24-square
// home zone, which Step 3's tests above deliberately avoid).
describe("PlacementState with the Skirmish army (16 pieces)", () => {
  const SKIRMISH = BOARD_LAYOUTS.standard_64;
  const SKIRMISH_ARMY = ARMY_COMPOSITIONS.standard_skirmish.roster;

  function emptySkirmish(side: "white" | "black") {
    return emptyPlacement(side, SKIRMISH, SKIRMISH_ARMY);
  }

  it("emptyPlacement carries the given army and seeds a matching 16-piece inventory", () => {
    const state = emptySkirmish("white");
    expect(state.army).toBe(SKIRMISH_ARMY);
    for (const id of PIECE_TYPES) {
      expect(remainingCount(state, id)).toBe(SKIRMISH_ARMY[id]);
    }
    expect(remainingCount(state, "footSoldier")).toBe(0);
    expect(remainingCount(state, "militia")).toBe(0);
  });

  it("progress reports a 16-piece total, not Battle's 25", () => {
    const state = emptySkirmish("white");
    expect(progress(state)).toEqual({ placed: 0, total: 16 });
  });

  it("is complete at 16 placed pieces, while an equally-sized subset of Battle's army is not yet complete", () => {
    // A flat list of piece type ids, each repeated `roster[id]` times -
    // respects each type's own remaining count, unlike placing the same type
    // repeatedly (which would exceed it well before 16).
    function flattenRoster(roster: ArmyRoster): PieceTypeId[] {
      const list: PieceTypeId[] = [];
      for (const id of PIECE_TYPES) {
        for (let i = 0; i < roster[id]; i += 1) {
          list.push(id);
        }
      }
      return list;
    }

    let skirmish = emptySkirmish("white");
    const skirmishHome = homeSquares("white", SKIRMISH);
    const skirmishPieces = flattenRoster(SKIRMISH_ARMY);
    expect(skirmishPieces).toHaveLength(16);
    for (let i = 0; i < skirmishPieces.length; i += 1) {
      skirmish = place(skirmish, skirmishHome[i], skirmishPieces[i]);
    }
    expect(placedCount(skirmish)).toBe(16);
    expect(isComplete(skirmish)).toBe(true);
    expect(progress(skirmish)).toEqual({ placed: 16, total: 16 });

    // The same 16 pieces, placed into Battle's army instead: fully valid
    // (Battle fields at least as many of each type), but only 16 of Battle's
    // own 25 - so not yet complete.
    let battle = emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY);
    const battleHome = homeSquares("white");
    for (let i = 0; i < skirmishPieces.length; i += 1) {
      battle = place(battle, battleHome[i], skirmishPieces[i]);
    }
    expect(placedCount(battle)).toBe(16);
    expect(isComplete(battle)).toBe(false); // Battle's army is 25, not 16.
  });

  it("autoFill fills exactly the 16-piece Skirmish army onto the Skirmish board, honoring the Tower rule", () => {
    const state = emptySkirmish("white");
    const filled = autoFill(state, seededRandom(11));

    expect(isComplete(filled)).toBe(true);
    for (const id of PIECE_TYPES) {
      expect(remainingCount(filled, id)).toBe(0);
    }

    const home = homeSquares("white", SKIRMISH);
    const counts = new Map<PieceTypeId, number>();
    let placedSquares = 0;
    for (const square of home) {
      const type = pieceAt(filled, square);
      if (type !== undefined) {
        placedSquares += 1;
        expect(isHomeSquareFor(square, "white", SKIRMISH)).toBe(true);
        counts.set(type, (counts.get(type) ?? 0) + 1);
      }
    }
    expect(placedSquares).toBe(16);
    expect(home).toHaveLength(24); // 8 of the 24 home squares stay empty.
    for (const id of PIECE_TYPES) {
      expect(counts.get(id) ?? 0).toBe(SKIRMISH_ARMY[id]);
    }
    expect(counts.get("footSoldier") ?? 0).toBe(0);
    expect(counts.get("militia") ?? 0).toBe(0);

    expect(towersLegallyPlaced(filled)).toBe(true);
    const towerSquares = home.filter(
      (square) => pieceAt(filled, square) === "tower",
    );
    expect(towerSquares).toHaveLength(3);
  });
});

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
  squaresClosedToTowers,
  swap,
  towerLaneRefusesPlacement,
  towerPlacementLegality,
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
    const state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    expect(placedCount(state)).toBe(0);
    expect(isComplete(state)).toBe(false);
    for (const entry of pieceCatalogEntries()) {
      expect(remainingCount(state, entry.id)).toBe(entry.quantityPerSide);
    }
  });
});

describe("place", () => {
  it("occupies the square and decrements remaining", () => {
    const state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
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
    const state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    for (const square of NON_HOME_SQUARES) {
      expect(() => place(state, square, "militia")).toThrow();
    }
    // Black's home squares are not White's home squares either.
    expect(() => place(state, BLACK_HOME[0], "militia")).toThrow();
  });

  it("rejects placing on an already-occupied square", () => {
    const state = place(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
      WHITE_HOME[0],
      "knight",
    );
    expect(() => place(state, WHITE_HOME[0], "militia")).toThrow();
  });

  it("rejects placing a piece type with zero remaining", () => {
    let state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
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
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
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
    const state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    expect(() => move(state, WHITE_HOME[0], WHITE_HOME[1])).toThrow();
  });

  it("rejects moving onto an already-occupied square", () => {
    let state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    state = place(state, WHITE_HOME[0], "champion");
    state = place(state, WHITE_HOME[1], "knight");
    expect(() => move(state, WHITE_HOME[0], WHITE_HOME[1])).toThrow();
  });

  it("rejects moving to or from a non-home square", () => {
    const state = place(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
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
    let state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
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
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
      WHITE_HOME[0],
      "champion",
    );
    expect(() => swap(state, WHITE_HOME[0], WHITE_HOME[1])).toThrow();
  });

  it("rejects swapping a non-home square", () => {
    let state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    state = place(state, WHITE_HOME[0], "champion");
    state = place(state, WHITE_HOME[1], "knight");
    expect(() => swap(state, WHITE_HOME[0], NON_HOME_SQUARES[1])).toThrow();
  });
});

describe("returnToTray", () => {
  it("empties the square and increments remaining", () => {
    const square = WHITE_HOME[0];
    const placed = place(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
      square,
      "tower",
    );
    const after = returnToTray(placed, square);

    expect(pieceAt(after, square)).toBeUndefined();
    expect(placedCount(after)).toBe(0);
    expect(remainingCount(after, "tower")).toBe(6);
  });

  it("rejects returning from an empty square", () => {
    const state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    expect(() => returnToTray(state, WHITE_HOME[0])).toThrow();
  });

  it("rejects returning from a non-home square", () => {
    const state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    expect(() => returnToTray(state, NON_HOME_SQUARES[1])).toThrow();
  });
});

describe("clear", () => {
  it("empties the board and restores the full 25-count inventory", () => {
    const full = placeFullArmy(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
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
    let state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    expect(progress(state)).toEqual({ placed: 0, total: ARMY_SIZE });

    state = place(state, WHITE_HOME[0], "militia");
    expect(progress(state)).toEqual({ placed: 1, total: ARMY_SIZE });

    state = place(state, WHITE_HOME[1], "militia");
    expect(progress(state)).toEqual({ placed: 2, total: ARMY_SIZE });
  });

  it("is complete only when all 25 pieces are placed, leaving the rest of the 48 home squares empty", () => {
    const state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
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
    let state = emptyPlacement(
      "black",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    state = place(state, BLACK_HOME[0], "knight");
    expect(pieceAt(state, BLACK_HOME[0])).toBe("knight");
    for (const square of WHITE_HOME) {
      expect(pieceAt(state, square)).toBeUndefined();
    }
  });
});

describe("towerPlacementLegality", () => {
  it("is legal with no Towers placed at all", () => {
    expect(
      towerPlacementLegality(
        emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
      ).legal,
    ).toBe(true);
  });

  it("is legal with a single Tower placed", () => {
    const state = place(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
      WHITE_HOME[0],
      "tower",
    );
    expect(towerPlacementLegality(state).legal).toBe(true);
  });

  it("is legal for two Towers that are not adjacent", () => {
    let state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    state = place(state, { column: "A", row: 1 }, "tower");
    state = place(state, { column: "D", row: 1 }, "tower");
    expect(towerPlacementLegality(state).legal).toBe(true);
  });

  it("reports a spacing violation for two orthogonally adjacent Towers", () => {
    let state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    state = place(state, { column: "A", row: 1 }, "tower");
    state = place(state, { column: "B", row: 1 }, "tower");
    const result = towerPlacementLegality(state);
    expect(result.legal).toBe(false);
    if (!result.legal) {
      expect(result.rule).toBe("spacing");
      expect(result.squares).toEqual([
        { column: "A", row: 1 },
        { column: "B", row: 1 },
      ]);
    }
  });

  it("reports a spacing violation for two diagonally adjacent Towers", () => {
    let state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    state = place(state, { column: "A", row: 1 }, "tower");
    state = place(state, { column: "B", row: 2 }, "tower");
    const result = towerPlacementLegality(state);
    expect(result.legal).toBe(false);
    if (!result.legal) {
      expect(result.rule).toBe("spacing");
    }
  });

  it("catches a spacing violation among more than two placed Towers", () => {
    let state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    state = place(state, { column: "A", row: 1 }, "tower");
    state = place(state, { column: "D", row: 1 }, "tower");
    state = place(state, { column: "D", row: 2 }, "tower"); // adjacent to D1
    expect(towerPlacementLegality(state).legal).toBe(false);
  });

  it("tracks each side's own Towers independently for the spacing rule", () => {
    let state = emptyPlacement(
      "black",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    state = place(state, { column: "A", row: 9 }, "tower");
    state = place(state, { column: "B", row: 9 }, "tower");
    expect(towerPlacementLegality(state).legal).toBe(false);
    expect(
      towerPlacementLegality(
        emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
      ).legal,
    ).toBe(true);
  });

  // Story 00000025, Step 4: the lane rule, applied only under
  // `spacing_and_lanes`, and only as a confirm-time backstop - drop-time
  // refusal (`towerLaneRefusesPlacement`, below) is expected to keep the UI
  // from ever reaching one of these states in practice.
  describe("the lane rule (spacing_and_lanes)", () => {
    const SKIRMISH = BOARD_LAYOUTS.standard_64;
    const SKIRMISH_ROSTER = ARMY_COMPOSITIONS.standard_skirmish.roster;

    it("reports a lane violation for a Tower on A3 under spacing_and_lanes", () => {
      const state = place(
        emptyPlacement("white", SKIRMISH, SKIRMISH_ROSTER, "spacing_and_lanes"),
        { column: "A", row: 3 },
        "tower",
      );
      const result = towerPlacementLegality(state);
      expect(result.legal).toBe(false);
      if (!result.legal) {
        expect(result.rule).toBe("lane");
        expect(result.squares).toEqual([{ column: "A", row: 3 }]);
      }
    });

    it("is legal for a Tower on A3 under spacing_only (the historical edition)", () => {
      const state = place(
        emptyPlacement("white", SKIRMISH, SKIRMISH_ROSTER, "spacing_only"),
        { column: "A", row: 3 },
        "tower",
      );
      expect(towerPlacementLegality(state).legal).toBe(true);
    });

    it("is legal for a Tower on Battle's A3 under spacing_and_lanes (the closed set is empty there)", () => {
      const state = place(
        emptyPlacement(
          "white",
          BATTLE_LAYOUT,
          BATTLE_ARMY,
          "spacing_and_lanes",
        ),
        { column: "A", row: 3 },
        "tower",
      );
      expect(towerPlacementLegality(state).legal).toBe(true);
    });

    it("reports every currently-placed Tower that is on a closed square", () => {
      let state = emptyPlacement(
        "white",
        SKIRMISH,
        SKIRMISH_ROSTER,
        "spacing_and_lanes",
      );
      state = place(state, { column: "A", row: 3 }, "tower");
      state = place(state, { column: "H", row: 3 }, "tower");
      const result = towerPlacementLegality(state);
      expect(result.legal).toBe(false);
      if (!result.legal) {
        expect(result.rule).toBe("lane");
        expect(result.squares).toEqual([
          { column: "A", row: 3 },
          { column: "H", row: 3 },
        ]);
      }
    });

    it("reports the spacing violation when both rules are broken at once", () => {
      // D3 and E3 are both closed to Towers (lane) and orthogonally adjacent
      // to each other (spacing) - a state only reachable by constructing it
      // directly, since drop-time refusal (Step 5) would refuse the second
      // Tower before it ever landed on a closed square.
      let state = emptyPlacement(
        "white",
        SKIRMISH,
        SKIRMISH_ROSTER,
        "spacing_and_lanes",
      );
      state = place(state, { column: "D", row: 3 }, "tower");
      state = place(state, { column: "E", row: 3 }, "tower");
      const result = towerPlacementLegality(state);
      expect(result.legal).toBe(false);
      if (!result.legal) {
        expect(result.rule).toBe("spacing");
      }
    });
  });
});

// Story 00000025, Step 4: the drop-time "would this specific placement be
// refused by the lane rule" query the UI (Step 5) consults before calling
// `place`/`move`/`swap`.
describe("towerLaneRefusesPlacement", () => {
  const SKIRMISH = BOARD_LAYOUTS.standard_64;
  const SKIRMISH_ROSTER = ARMY_COMPOSITIONS.standard_skirmish.roster;

  it("refuses a Tower onto a closed square", () => {
    const state = emptyPlacement(
      "white",
      SKIRMISH,
      SKIRMISH_ROSTER,
      "spacing_and_lanes",
    );
    expect(
      towerLaneRefusesPlacement(state, { column: "A", row: 3 }, "tower"),
    ).toBe(true);
  });

  it("does not refuse a non-Tower onto a closed square", () => {
    const state = emptyPlacement(
      "white",
      SKIRMISH,
      SKIRMISH_ROSTER,
      "spacing_and_lanes",
    );
    expect(
      towerLaneRefusesPlacement(state, { column: "A", row: 3 }, "knight"),
    ).toBe(false);
  });

  it("does not refuse a Tower onto an open square", () => {
    const state = emptyPlacement(
      "white",
      SKIRMISH,
      SKIRMISH_ROSTER,
      "spacing_and_lanes",
    );
    expect(
      towerLaneRefusesPlacement(state, { column: "B", row: 3 }, "tower"),
    ).toBe(false);
  });

  it("never refuses a Tower on Battle, regardless of square or variant value", () => {
    const spacingAndLanes = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_and_lanes",
    );
    for (const square of WHITE_HOME) {
      expect(towerLaneRefusesPlacement(spacingAndLanes, square, "tower")).toBe(
        false,
      );
    }
  });

  it("never refuses a Tower under spacing_only, regardless of square", () => {
    const state = emptyPlacement(
      "white",
      SKIRMISH,
      SKIRMISH_ROSTER,
      "spacing_only",
    );
    expect(
      towerLaneRefusesPlacement(state, { column: "A", row: 3 }, "tower"),
    ).toBe(false);
  });
});

// Story 00000025, Step 3: `squaresClosedToTowers` combines the `TOWER_PLACEMENT`
// variant (`state.towerPlacement`) with the Step 2 lane geometry
// (`homeSquaresFacingLane`). The expected square lists below are the rules'
// own definition applied to `standard_64` (see board.test.ts's own tests of
// `homeSquaresFacingLane`, which this function calls unmodified) - not
// hardcoded in the implementation itself.
describe("squaresClosedToTowers", () => {
  const SKIRMISH = BOARD_LAYOUTS.standard_64;
  const SKIRMISH_ROSTER = ARMY_COMPOSITIONS.standard_skirmish.roster;

  it("reports the four lane-facing home squares for a spacing_and_lanes Skirmish state", () => {
    const white = emptyPlacement(
      "white",
      SKIRMISH,
      SKIRMISH_ROSTER,
      "spacing_and_lanes",
    );
    expect(squaresClosedToTowers(white)).toEqual([
      { column: "A", row: 3 },
      { column: "D", row: 3 },
      { column: "E", row: 3 },
      { column: "H", row: 3 },
    ]);

    const black = emptyPlacement(
      "black",
      SKIRMISH,
      SKIRMISH_ROSTER,
      "spacing_and_lanes",
    );
    expect(squaresClosedToTowers(black)).toEqual([
      { column: "A", row: 6 },
      { column: "D", row: 6 },
      { column: "E", row: 6 },
      { column: "H", row: 6 },
    ]);
  });

  it("reports nothing for a spacing_only Skirmish state - the historical 2-0:SKIRMISH edition", () => {
    const state = emptyPlacement(
      "white",
      SKIRMISH,
      SKIRMISH_ROSTER,
      "spacing_only",
    );
    expect(squaresClosedToTowers(state)).toEqual([]);
  });

  it("reports nothing for a Battle state, regardless of the variant value", () => {
    expect(
      squaresClosedToTowers(
        emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
      ),
    ).toEqual([]);
    expect(
      squaresClosedToTowers(
        emptyPlacement(
          "white",
          BATTLE_LAYOUT,
          BATTLE_ARMY,
          "spacing_and_lanes",
        ),
      ),
    ).toEqual([]);
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
    const state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
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
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
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
        emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
        seededRandom(seed),
      );
      expect(towerPlacementLegality(filled).legal).toBe(true);

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
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
      seededRandom(2),
    );
    for (const square of NON_HOME_SQUARES) {
      expect(pieceAt(filled, square)).toBeUndefined();
    }
  });

  it("leaves already-placed pieces untouched and completes the army around them", () => {
    let state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    state = place(state, WHITE_HOME[0], "flag");
    state = place(state, WHITE_HOME[1], "masterOfArms");

    const filled = autoFill(state, seededRandom(3));

    expect(pieceAt(filled, WHITE_HOME[0])).toBe("flag");
    expect(pieceAt(filled, WHITE_HOME[1])).toBe("masterOfArms");
    expect(isComplete(filled)).toBe(true);
    for (const entry of pieceCatalogEntries()) {
      expect(remainingCount(filled, entry.id)).toBe(0);
    }
    expect(towerPlacementLegality(filled).legal).toBe(true);
  });

  it("respects the Tower rule even when a Tower is already placed before autoFill runs", () => {
    const state = place(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
      WHITE_HOME[0],
      "tower",
    );
    for (const seed of [7, 8, 9]) {
      const filled = autoFill(state, seededRandom(seed));
      expect(pieceAt(filled, WHITE_HOME[0])).toBe("tower");
      expect(towerPlacementLegality(filled).legal).toBe(true);
    }
  });

  it("is reproducible with a fixed seed", () => {
    const state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
    const first = autoFill(state, seededRandom(42));
    const second = autoFill(state, seededRandom(42));

    for (const square of WHITE_HOME) {
      expect(pieceAt(first, square)).toBe(pieceAt(second, square));
    }
  });

  it("tracks each side's own home squares independently", () => {
    const filled = autoFill(
      emptyPlacement("black", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
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
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only"),
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
    const state = emptyPlacement(
      "white",
      SKIRMISH,
      SKIRMISH_ROSTER,
      "spacing_only",
    );
    expect(state.boardLayout).toBe(SKIRMISH);
  });

  it("gives each side exactly 24 home squares, not Battle's 48", () => {
    expect(homeSquares("white", SKIRMISH)).toHaveLength(24);
    expect(homeSquares("black", SKIRMISH)).toHaveLength(24);
  });

  it("place/pieceAt work on a Skirmish home square", () => {
    const square: Square = { column: "D", row: 2 };
    const state = place(
      emptyPlacement("white", SKIRMISH, SKIRMISH_ROSTER, "spacing_only"),
      square,
      "knight",
    );
    expect(pieceAt(state, square)).toBe("knight");
  });

  it("rejects a square outside the Skirmish board's own home zone (row 9, on-board for Battle but not for Skirmish)", () => {
    const state = emptyPlacement(
      "white",
      SKIRMISH,
      SKIRMISH_ROSTER,
      "spacing_only",
    );
    expect(() => place(state, { column: "A", row: 9 }, "knight")).toThrow();
  });

  it("clear() preserves the board layout", () => {
    const state = place(
      emptyPlacement("white", SKIRMISH, SKIRMISH_ROSTER, "spacing_only"),
      { column: "D", row: 2 },
      "knight",
    );
    const cleared = clear(state);
    expect(cleared.boardLayout).toBe(SKIRMISH);
    expect(placedCount(cleared)).toBe(0);
  });

  it("towerPlacementLegality is legal for two Towers that are not adjacent, near the Skirmish edge (H3, White's home corner)", () => {
    let state = emptyPlacement(
      "white",
      SKIRMISH,
      SKIRMISH_ROSTER,
      "spacing_only",
    );
    state = place(state, { column: "H", row: 3 }, "tower");
    state = place(state, { column: "F", row: 3 }, "tower");
    expect(towerPlacementLegality(state).legal).toBe(true);
  });

  it("towerPlacementLegality is not legal for two Towers diagonally adjacent at the H3 corner", () => {
    let state = emptyPlacement(
      "white",
      SKIRMISH,
      SKIRMISH_ROSTER,
      "spacing_only",
    );
    state = place(state, { column: "H", row: 3 }, "tower");
    state = place(state, { column: "G", row: 2 }, "tower");
    expect(towerPlacementLegality(state).legal).toBe(false);
  });

  it("does not disturb Battle's own board layout", () => {
    expect(
      emptyPlacement("white", BATTLE_LAYOUT, BATTLE_ARMY, "spacing_only")
        .boardLayout,
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
    return emptyPlacement(side, SKIRMISH, SKIRMISH_ARMY, "spacing_only");
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
    let battle = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_only",
    );
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

    expect(towerPlacementLegality(filled).legal).toBe(true);
    const towerSquares = home.filter(
      (square) => pieceAt(filled, square) === "tower",
    );
    expect(towerSquares).toHaveLength(3);
  });
});

// Story 00000025, Step 3: autoFill must never place a Tower on a square
// squaresClosedToTowers reports, and must keep satisfying the existing
// spacing rule. Proven with a high-iteration loop - both a seeded
// RandomSource (reproducible) and Math.random (real randomness, to catch
// anything a fixed set of seeds might happen to hide) - so a Skirmish
// auto-fill is reliable every time it places 3 Towers into a 24-square home
// zone with 4 of them closed, not just on the handful of seeds exercised
// elsewhere in this file. The same loop on Battle proves nothing regressed.
describe("autoFill honors squaresClosedToTowers (story 00000025)", () => {
  const SKIRMISH = BOARD_LAYOUTS.standard_64;
  const SKIRMISH_ROSTER = ARMY_COMPOSITIONS.standard_skirmish.roster;
  const ITERATIONS = 200;

  function assertLegalSkirmishFill(random: RandomSource): void {
    const state = emptyPlacement(
      "white",
      SKIRMISH,
      SKIRMISH_ROSTER,
      "spacing_and_lanes",
    );
    const closedKeys = new Set(
      squaresClosedToTowers(state).map(
        (square) => `${square.column}${square.row}`,
      ),
    );
    expect(closedKeys.size).toBe(4);

    const filled = autoFill(state, random);
    expect(isComplete(filled)).toBe(true);

    const home = homeSquares("white", SKIRMISH);
    const towerSquares = home.filter(
      (square) => pieceAt(filled, square) === "tower",
    );
    expect(towerSquares).toHaveLength(3);
    for (const square of towerSquares) {
      expect(closedKeys.has(`${square.column}${square.row}`)).toBe(false);
    }
    expect(towerPlacementLegality(filled).legal).toBe(true);
  }

  it("never lands a Tower on a closed square, across 200 seeded Skirmish auto-fills", () => {
    for (let seed = 1; seed <= ITERATIONS; seed += 1) {
      assertLegalSkirmishFill(seededRandom(seed));
    }
  });

  it("never lands a Tower on a closed square, across 200 Math.random Skirmish auto-fills", () => {
    for (let i = 0; i < ITERATIONS; i += 1) {
      assertLegalSkirmishFill(Math.random);
    }
  });

  function assertLegalBattleFill(random: RandomSource): void {
    const state = emptyPlacement(
      "white",
      BATTLE_LAYOUT,
      BATTLE_ARMY,
      "spacing_and_lanes",
    );
    // Battle's closed set is always empty by geometry (its home zones sit a
    // buffer row away from any lake row), so spacing_and_lanes is inert here
    // - exercised deliberately to prove that inertness rather than assuming
    // it.
    expect(squaresClosedToTowers(state)).toEqual([]);

    const filled = autoFill(state, random);
    expect(isComplete(filled)).toBe(true);
    expect(towerPlacementLegality(filled).legal).toBe(true);
  }

  it("still fills Battle reliably, across 200 seeded auto-fills (nothing regressed)", () => {
    for (let seed = 1; seed <= ITERATIONS; seed += 1) {
      assertLegalBattleFill(seededRandom(seed));
    }
  });

  it("still fills Battle reliably, across 200 Math.random auto-fills (nothing regressed)", () => {
    for (let i = 0; i < ITERATIONS; i += 1) {
      assertLegalBattleFill(Math.random);
    }
  });
});

// Peer review (story 00000025) finding #7: the earlier `autoFill` coverage
// above only ever starts from a *fresh* Skirmish placement. This block adds
// coverage starting from a *partially hand-filled* `spacing_and_lanes`
// Skirmish state - closer to what a player who places some pieces by hand
// before reaching for Auto-fill actually does - including states that
// already have one or more Towers down.
describe("autoFill from a partially hand-filled state (peer review finding #7)", () => {
  const SKIRMISH = BOARD_LAYOUTS.standard_64;
  const SKIRMISH_ROSTER = ARMY_COMPOSITIONS.standard_skirmish.roster;
  const ITERATIONS = 200;

  it("still succeeds when some non-Tower pieces are already hand-placed, across 200 seeded fills", () => {
    for (let seed = 1; seed <= ITERATIONS; seed += 1) {
      let state = emptyPlacement(
        "white",
        SKIRMISH,
        SKIRMISH_ROSTER,
        "spacing_and_lanes",
      );
      // Hand-place a handful of non-Tower pieces, spread out rather than
      // clustered, before handing the rest to auto-fill.
      state = place(state, { column: "B", row: 1 }, "masterOfArms");
      state = place(state, { column: "F", row: 1 }, "champion");
      state = place(state, { column: "D", row: 2 }, "knight");
      state = place(state, { column: "G", row: 3 }, "halberdier");

      const filled = autoFill(state, seededRandom(seed));
      expect(isComplete(filled)).toBe(true);
      expect(towerPlacementLegality(filled).legal).toBe(true);
      const closedKeys = new Set(
        squaresClosedToTowers(state).map(
          (square) => `${square.column}${square.row}`,
        ),
      );
      const towerSquares = homeSquares("white", SKIRMISH).filter(
        (square) => pieceAt(filled, square) === "tower",
      );
      expect(towerSquares).toHaveLength(3);
      for (const square of towerSquares) {
        expect(closedKeys.has(`${square.column}${square.row}`)).toBe(false);
      }
    }
  });

  it("still succeeds when one Tower is already hand-placed (on an open square), across 200 seeded fills", () => {
    for (let seed = 1; seed <= ITERATIONS; seed += 1) {
      let state = emptyPlacement(
        "white",
        SKIRMISH,
        SKIRMISH_ROSTER,
        "spacing_and_lanes",
      );
      // B3/C3/F3/G3 stay open under spacing_and_lanes (they sit behind
      // lakes, not lanes) - a legal square for a hand-placed Tower.
      state = place(state, { column: "C", row: 3 }, "tower");

      const filled = autoFill(state, seededRandom(seed));
      expect(isComplete(filled)).toBe(true);
      expect(towerPlacementLegality(filled).legal).toBe(true);
    }
  });

  it("still succeeds when all three Towers are already hand-placed, across 200 seeded fills", () => {
    for (let seed = 1; seed <= ITERATIONS; seed += 1) {
      let state = emptyPlacement(
        "white",
        SKIRMISH,
        SKIRMISH_ROSTER,
        "spacing_and_lanes",
      );
      state = place(state, { column: "B", row: 1 }, "tower");
      state = place(state, { column: "E", row: 1 }, "tower");
      state = place(state, { column: "H", row: 1 }, "tower");

      const filled = autoFill(state, seededRandom(seed));
      expect(isComplete(filled)).toBe(true);
      expect(towerPlacementLegality(filled).legal).toBe(true);
    }
  });

  // This case is the reason for the peer review comment: it is a state a
  // player could plausibly reach by hand - placing every non-Tower piece
  // (all 13 of Skirmish's masters-of-arms/champions/knights/halberdiers/flag)
  // before touching Auto-fill for the three Towers - that nonetheless makes
  // `pickTowerSquares` throw. The 13 non-Tower pieces below are placed on 13
  // of Skirmish's 20 open (non-closed) home squares, deliberately chosen so
  // the 7 open squares left empty (A1, B1, C1, D1, A2, B2, C2 - a compact
  // 4-column-by-2-row corner of the home zone) contain no three mutually
  // non-adjacent squares: any two of those seven are within a king's move of
  // each other whenever a third is added (the block's maximum independent
  // set, under the same orthogonal-or-diagonal adjacency `isAdjacentOrSame`
  // checks, is only 2). With exactly three Towers left to place and exactly
  // those seven non-closed squares free, no arrangement can satisfy the
  // spacing rule, so `autoFill` exhausts its attempts and throws - reported
  // to the owner per the review comment rather than silently "fixed" here,
  // since changing the throw contract (e.g. to a recoverable result) was
  // explicitly out of scope for this fix.
  it("demonstrates a plausible partially hand-filled state where auto-fill exhausts (reported, not fixed)", () => {
    let state = emptyPlacement(
      "white",
      SKIRMISH,
      SKIRMISH_ROSTER,
      "spacing_and_lanes",
    );
    const nonTowerPlacements: readonly [Square, PieceTypeId][] = [
      [{ column: "E", row: 1 }, "masterOfArms"],
      [{ column: "F", row: 1 }, "masterOfArms"],
      [{ column: "G", row: 1 }, "masterOfArms"],
      [{ column: "H", row: 1 }, "champion"],
      [{ column: "D", row: 2 }, "champion"],
      [{ column: "E", row: 2 }, "champion"],
      [{ column: "F", row: 2 }, "knight"],
      [{ column: "G", row: 2 }, "knight"],
      [{ column: "H", row: 2 }, "knight"],
      [{ column: "B", row: 3 }, "halberdier"],
      [{ column: "C", row: 3 }, "halberdier"],
      [{ column: "F", row: 3 }, "halberdier"],
      [{ column: "G", row: 3 }, "flag"],
    ];
    for (const [square, type] of nonTowerPlacements) {
      state = place(state, square, type);
    }

    expect(() => autoFill(state, Math.random)).toThrow(
      "autoFill: could not find Tower squares satisfying the no-adjacent-Towers rule.",
    );
  });
});

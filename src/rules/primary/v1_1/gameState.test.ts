import { describe, expect, it } from "vitest";
import { homeSquares } from "./board.ts";
import { pieceCatalogEntries } from "./pieces.ts";
import { autoFill, emptyPlacement, type PlacementState } from "./placement.ts";
import {
  buildInitialGameState,
  renderPositionBlock,
  RULESET_TAG,
  type InitialGameState,
} from "./gameState.ts";

/** A tiny seeded linear-congruential generator (see placement.test.ts). */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function completeArmy(side: "white" | "black", seed: number): PlacementState {
  return autoFill(emptyPlacement(side), seededRandom(seed));
}

describe("buildInitialGameState (ruleset PRIMARY:1.1)", () => {
  it("tags the artifact with the ruleset version", () => {
    const white = completeArmy("white", 1);
    const black = completeArmy("black", 2);
    const gameState = buildInitialGameState(white, black);

    expect(gameState.ruleset).toBe("PRIMARY:1.1");
    expect(gameState.ruleset).toBe(RULESET_TAG);
  });

  it("round-trips both armies exactly through JSON", () => {
    const white = completeArmy("white", 3);
    const black = completeArmy("black", 4);
    const gameState = buildInitialGameState(white, black);

    const roundTripped = JSON.parse(
      JSON.stringify(gameState),
    ) as InitialGameState;
    expect(roundTripped).toEqual(gameState);

    // Every White home square in the artifact matches the source placement,
    // and vice versa - nothing was dropped, duplicated, or mislabeled.
    for (const square of homeSquares("white")) {
      const key = `${square.column}${square.row}`;
      const placed = roundTripped.board[key];
      expect(placed?.side).toBe("white");
      expect(placed?.pieceType).toBe(white.placements.get(key));
    }
    for (const square of homeSquares("black")) {
      const key = `${square.column}${square.row}`;
      const placed = roundTripped.board[key];
      expect(placed?.side).toBe("black");
      expect(placed?.pieceType).toBe(black.placements.get(key));
    }

    // No square outside either side's 48 home squares is ever populated.
    expect(Object.keys(roundTripped.board)).toHaveLength(96);
  });

  it("rejects a White state and Black state passed in the wrong slots", () => {
    const white = completeArmy("white", 5);
    const black = completeArmy("black", 6);
    expect(() => buildInitialGameState(black, white)).toThrow();
  });

  it("rejects incomplete armies", () => {
    const white = completeArmy("white", 7);
    const black = emptyPlacement("black");
    expect(() => buildInitialGameState(white, black)).toThrow();
  });

  it("includes every placed piece type at the ruleset's per-side quantity", () => {
    const white = completeArmy("white", 8);
    const black = completeArmy("black", 9);
    const gameState = buildInitialGameState(white, black);

    for (const side of ["white", "black"] as const) {
      const counts = new Map<string, number>();
      for (const placed of Object.values(gameState.board)) {
        if (placed.side !== side) continue;
        counts.set(placed.pieceType, (counts.get(placed.pieceType) ?? 0) + 1);
      }
      for (const entry of pieceCatalogEntries()) {
        expect(counts.get(entry.id)).toBe(entry.quantityPerSide);
      }
    }
  });
});

describe("renderPositionBlock (ruleset PRIMARY:1.1)", () => {
  it("renders a hand-constructed placement to the exact expected block", () => {
    // A small, deliberately sparse board (not a full army) so the expected
    // block below can be verified by inspection square-by-square:
    //   A1  = White Flag        -> [F]
    //   L1  = White Lord Marshal -> [1]
    //   F12 = Black Assassin    -> *A*
    //   A12 = Black Tower       -> *T*
    // every other square is either empty (---) or one of the three 2x2 lakes
    // on rows 6-7 (XXX), per the `O L L O O L L O O L L O` pattern.
    const gameState: InitialGameState = {
      ruleset: RULESET_TAG,
      board: {
        A1: { side: "white", pieceType: "flag" },
        L1: { side: "white", pieceType: "lordMarshal" },
        F12: { side: "black", pieceType: "assassin" },
        A12: { side: "black", pieceType: "tower" },
      },
    };

    const expected = [
      "*T* --- --- --- --- *A* --- --- --- --- --- ---",
      "--- --- --- --- --- --- --- --- --- --- --- ---",
      "--- --- --- --- --- --- --- --- --- --- --- ---",
      "--- --- --- --- --- --- --- --- --- --- --- ---",
      "--- --- --- --- --- --- --- --- --- --- --- ---",
      "--- XXX XXX --- --- XXX XXX --- --- XXX XXX ---",
      "--- XXX XXX --- --- XXX XXX --- --- XXX XXX ---",
      "--- --- --- --- --- --- --- --- --- --- --- ---",
      "--- --- --- --- --- --- --- --- --- --- --- ---",
      "--- --- --- --- --- --- --- --- --- --- --- ---",
      "--- --- --- --- --- --- --- --- --- --- --- ---",
      "[F] --- --- --- --- --- --- --- --- --- --- [1]",
    ].join("\n");

    expect(renderPositionBlock(gameState)).toBe(expected);
  });

  it("is 12 lines of 12 three-character cells", () => {
    const white = completeArmy("white", 10);
    const black = completeArmy("black", 11);
    const gameState = buildInitialGameState(white, black);

    const lines = renderPositionBlock(gameState).split("\n");
    expect(lines).toHaveLength(12);
    for (const line of lines) {
      const cells = line.split(" ");
      expect(cells).toHaveLength(12);
      for (const cell of cells) {
        expect(cell).toHaveLength(3);
      }
    }
  });

  it("renders lake squares as XXX regardless of nearby placements", () => {
    const white = completeArmy("white", 12);
    const black = completeArmy("black", 13);
    const gameState = buildInitialGameState(white, black);
    const lines = renderPositionBlock(gameState).split("\n");

    // Rows 6 and 7 are the 6th and 7th lines from the bottom (row 1 is the
    // last line, row 12 the first): row 7 -> index 5, row 6 -> index 6.
    const row7 = lines[5].split(" ");
    const row6 = lines[6].split(" ");
    const lakeColumnIndexes = [1, 2, 5, 6, 9, 10]; // B, C, F, G, J, K
    for (const index of lakeColumnIndexes) {
      expect(row7[index]).toBe("XXX");
      expect(row6[index]).toBe("XXX");
    }
  });
});

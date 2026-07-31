import { describe, expect, it } from "vitest";
import {
  allSquares,
  squareKey,
  type Side,
  type Square,
} from "../../rules/primary/v2/board.ts";
import type {
  BoardState,
  PlacedPiece,
} from "../../rules/primary/v2/gameState.ts";
import {
  legalAttacks,
  legalDestinations,
} from "../../rules/primary/v2/movement.ts";
import type { PieceTypeId } from "../../rules/primary/v2/pieces.ts";
import {
  MOVEMENT_OFFSETS,
  POLICY_LENGTH,
  policyIndexForPly,
  type Ply,
} from "./decoder.ts";
import { flatIndex } from "./shared.ts";

/** Builds a `BoardState` from a list of `[squareKey, side, pieceType]` triples. */
function board(
  pieces: readonly [string, PlacedPiece["side"], PieceTypeId][],
): BoardState {
  const result: Record<string, PlacedPiece> = {};
  for (const [key, side, pieceType] of pieces) {
    result[key] = { side, pieceType };
  }
  return result;
}

/** White's tensor coordinates, computed independently of `shared.ts` for a from-scratch check. */
function whiteTensor(square: Square): { row: number; col: number } {
  return { row: square.row - 1, col: "ABCDEFGHIJKL".indexOf(square.column) };
}

/** Black's tensor coordinates, computed independently of `shared.ts` for a from-scratch check. */
function blackTensor(square: Square): { row: number; col: number } {
  return {
    row: 12 - square.row,
    col: 11 - "ABCDEFGHIJKL".indexOf(square.column),
  };
}

/** Every legal ply for `side` on `boardState`, recomputed directly from the rules engine's own API. */
function legalPliesFor(boardState: BoardState, side: Side): Ply[] {
  const plies: Ply[] = [];
  for (const origin of allSquares()) {
    const occupant = boardState[squareKey(origin)];
    if (occupant === undefined || occupant.side !== side) {
      continue;
    }
    for (const to of legalDestinations(boardState, origin)) {
      plies.push({ from: origin, to });
    }
    for (const to of legalAttacks(boardState, origin)) {
      plies.push({ from: origin, to });
    }
  }
  return plies;
}

describe("MOVEMENT_OFFSETS", () => {
  it("matches the ENG_NN_1 spec table exactly", () => {
    expect(MOVEMENT_OFFSETS).toEqual([
      { dRow: 1, dCol: 0 }, // up one
      { dRow: 0, dCol: 1 }, // right one
      { dRow: -1, dCol: 0 }, // down one
      { dRow: 0, dCol: -1 }, // left one
      { dRow: 2, dCol: 0 }, // up two
      { dRow: 0, dCol: 2 }, // right two
      { dRow: -2, dCol: 0 }, // down two
      { dRow: 0, dCol: -2 }, // left two
    ]);
  });
});

describe("policyIndexForPly", () => {
  const from: Square = { column: "E", row: 5 };

  const WHITE_CASES: readonly [string, Square, number][] = [
    ["up one", { column: "E", row: 6 }, 0],
    ["right one", { column: "F", row: 5 }, 1],
    ["down one", { column: "E", row: 4 }, 2],
    ["left one", { column: "D", row: 5 }, 3],
    ["up two", { column: "E", row: 7 }, 4],
    ["right two", { column: "G", row: 5 }, 5],
    ["down two", { column: "E", row: 3 }, 6],
    ["left two", { column: "C", row: 5 }, 7],
  ];

  // Black's frame is White's rotated 180 degrees, so the *board* direction
  // that lands on each movement index flips sign relative to White's.
  const BLACK_CASES: readonly [string, Square, number][] = [
    ["up one", { column: "E", row: 4 }, 0],
    ["right one", { column: "D", row: 5 }, 1],
    ["down one", { column: "E", row: 6 }, 2],
    ["left one", { column: "F", row: 5 }, 3],
    ["up two", { column: "E", row: 3 }, 4],
    ["right two", { column: "C", row: 5 }, 5],
    ["down two", { column: "E", row: 7 }, 6],
    ["left two", { column: "G", row: 5 }, 7],
  ];

  for (const [label, to, movementIndex] of WHITE_CASES) {
    it(`White, ${label}: maps to movement index ${movementIndex} at the source's tensor cell`, () => {
      const { row, col } = whiteTensor(from);
      const expected = flatIndex(movementIndex, row, col);
      const actual = policyIndexForPly({ from, to }, "white");
      expect(actual).toBe(expected);
      expect(actual).toBeGreaterThanOrEqual(0);
      expect(actual).toBeLessThan(POLICY_LENGTH);
    });
  }

  for (const [label, to, movementIndex] of BLACK_CASES) {
    it(`Black, ${label}: maps to movement index ${movementIndex} at the source's tensor cell (180-degree sign flip)`, () => {
      const { row, col } = blackTensor(from);
      const expected = flatIndex(movementIndex, row, col);
      const actual = policyIndexForPly({ from, to }, "black");
      expect(actual).toBe(expected);
      expect(actual).toBeGreaterThanOrEqual(0);
      expect(actual).toBeLessThan(POLICY_LENGTH);
    });
  }

  it("maps every legal ply from a real position to a distinct, in-range flat index", () => {
    // Militia at E5 (unencumbered) with an enemy two squares away at E7:
    // exercises all 8 offsets at once (7 destinations + 1 attack).
    const militiaBoard = board([
      ["E5", "white", "militia"],
      ["E7", "black", "militia"],
    ]);
    const plies = legalPliesFor(militiaBoard, "white");
    expect(plies).toHaveLength(8);

    const indices = plies.map((ply) => policyIndexForPly(ply, "white"));
    for (const index of indices) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(POLICY_LENGTH);
    }
    expect(new Set(indices).size).toBe(indices.length);
  });
});

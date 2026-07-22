import { describe, expect, it } from "vitest";
import { allSquares, isLake } from "../../rules/primary/v1/board.ts";
import type {
  BoardState,
  PlacedPiece,
} from "../../rules/primary/v1/gameState.ts";
import { INACTIVITY_LIMIT } from "../../rules/primary/v1/outcome.ts";
import type { PieceTypeId } from "../../rules/primary/v1/pieces.ts";
import { encodePosition, type Position } from "./encoder.ts";
import { flatIndex, INPUT_LENGTH, PLANE_COUNT, TENSOR_SIZE } from "./shared.ts";

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

/** A board with one White Master-of-Arms and one Black Champion. */
function twoPieceBoard(): BoardState {
  return board([
    ["C2", "white", "masterOfArms"],
    ["D9", "black", "champion"],
  ]);
}

describe("encodePosition - White to move", () => {
  const position: Position = {
    board: twoPieceBoard(),
    sideToMove: "white",
    inactivityCounter: 0,
  };
  const encoded = encodePosition(position);

  it("places the mover's (White) Master-of-Arms on plane 2 at row 1, col 2", () => {
    // masterOfArms is index 2 in PLANE_PIECE_ORDER; White C2 -> row 1, col 2.
    expect(encoded.data[flatIndex(2, 1, 2)]).toBe(1);
  });

  it("places the opponent's (Black) Champion on plane 11 at row 8, col 3", () => {
    // champion is index 3 -> opponent plane 8 + 3 = 11; White D9 -> row 8, col 3.
    expect(encoded.data[flatIndex(11, 8, 3)]).toBe(1);
  });

  it("leaves every other piece-plane cell at 0", () => {
    let onesCount = 0;
    for (let plane = 0; plane < 16; plane++) {
      for (let row = 0; row < TENSOR_SIZE; row++) {
        for (let col = 0; col < TENSOR_SIZE; col++) {
          onesCount += encoded.data[flatIndex(plane, row, col)];
        }
      }
    }
    expect(onesCount).toBe(2);
  });
});

describe("encodePosition - Black to move (180-degree rotation + our/their swap)", () => {
  const position: Position = {
    board: twoPieceBoard(),
    sideToMove: "black",
    inactivityCounter: 0,
  };
  const encoded = encodePosition(position);

  it("places the mover's (Black) Champion on plane 3 at row 3, col 8", () => {
    // Black to move: champion is now "our" piece, plane 0 + 3 = 3.
    // D9 in Black's frame: row = 12 - 9 = 3, col = 11 - 3 = 8.
    expect(encoded.data[flatIndex(3, 3, 8)]).toBe(1);
  });

  it("places the opponent's (White) Master-of-Arms on plane 10 at row 10, col 9", () => {
    // Black to move: masterOfArms is now the opponent's piece, plane 8 + 2 = 10.
    // C2 in Black's frame: row = 12 - 2 = 10, col = 11 - 2 = 9.
    expect(encoded.data[flatIndex(10, 10, 9)]).toBe(1);
  });
});

describe("encodePosition - passable plane", () => {
  it("is 0 exactly on the 12 lake squares and 1 elsewhere, for either mover", () => {
    for (const sideToMove of ["white", "black"] as const) {
      const encoded = encodePosition({
        board: {},
        sideToMove,
        inactivityCounter: 0,
      });

      let lakeCount = 0;
      for (const square of allSquares()) {
        const columnIndex = "ABCDEFGHIJKL".indexOf(square.column);
        const row = sideToMove === "white" ? square.row - 1 : 12 - square.row;
        const col = sideToMove === "white" ? columnIndex : 11 - columnIndex;
        const expected = isLake(square) ? 0 : 1;
        if (isLake(square)) {
          lakeCount++;
        }
        expect(encoded.data[flatIndex(16, row, col)]).toBe(expected);
      }
      expect(lakeCount).toBe(12);
    }
  });
});

describe("encodePosition - inactivity plane", () => {
  it("is uniformly counter / INACTIVITY_LIMIT across all 144 cells", () => {
    const counter = 13;
    const encoded = encodePosition({
      board: {},
      sideToMove: "white",
      inactivityCounter: counter,
    });
    const expected = counter / INACTIVITY_LIMIT;

    for (let row = 0; row < TENSOR_SIZE; row++) {
      for (let col = 0; col < TENSOR_SIZE; col++) {
        expect(encoded.data[flatIndex(17, row, col)]).toBeCloseTo(expected);
      }
    }
  });

  it("is uniformly 0 when the counter is 0", () => {
    const encoded = encodePosition({
      board: {},
      sideToMove: "white",
      inactivityCounter: 0,
    });
    for (let row = 0; row < TENSOR_SIZE; row++) {
      for (let col = 0; col < TENSOR_SIZE; col++) {
        expect(encoded.data[flatIndex(17, row, col)]).toBe(0);
      }
    }
  });
});

describe("encodePosition - shape", () => {
  it("returns a flat Float32Array of length 2592 with dims [1, 18, 12, 12]", () => {
    const encoded = encodePosition({
      board: twoPieceBoard(),
      sideToMove: "white",
      inactivityCounter: 7,
    });

    expect(encoded.data).toBeInstanceOf(Float32Array);
    expect(encoded.data.length).toBe(INPUT_LENGTH);
    expect(encoded.data.length).toBe(2592);
    expect(encoded.dims).toEqual([1, 18, 12, 12]);
    expect(PLANE_COUNT * TENSOR_SIZE * TENSOR_SIZE).toBe(2592);
  });

  it("every value is 0, 1, or the expected inactivity fraction", () => {
    const counter = 25;
    const expectedInactivity = counter / INACTIVITY_LIMIT;
    const encoded = encodePosition({
      board: twoPieceBoard(),
      sideToMove: "black",
      inactivityCounter: counter,
    });

    for (const value of encoded.data) {
      expect(
        value === 0 ||
          value === 1 ||
          Math.abs(value - expectedInactivity) < 1e-9,
      ).toBe(true);
    }
  });
});

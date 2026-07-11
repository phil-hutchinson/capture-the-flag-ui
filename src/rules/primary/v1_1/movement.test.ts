import { describe, expect, it } from "vitest";
import type { Square } from "./board.ts";
import type { BoardState, PlacedPiece } from "./gameState.ts";
import { hasAnyLegalMove, legalDestinations } from "./movement.ts";
import type { PieceTypeId } from "./pieces.ts";

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

/** Sorts destinations for order-independent comparison. */
function sortedKeys(squares: readonly Square[]): string[] {
  return squares.map((s) => `${s.column}${s.row}`).sort();
}

describe("legalDestinations (ruleset PRIMARY:1.1, empty-square moves only)", () => {
  it("gives a baseline piece its four orthogonal empties in open space", () => {
    const state = board([["D5", "white", "infantry"]]);
    const destinations = legalDestinations(state, { column: "D", row: 5 });
    expect(sortedKeys(destinations)).toEqual(["C5", "D4", "D6", "E5"].sort());
  });

  it("prunes off-board directions at a corner", () => {
    const state = board([["A1", "white", "infantry"]]);
    const destinations = legalDestinations(state, { column: "A", row: 1 });
    expect(sortedKeys(destinations)).toEqual(["A2", "B1"].sort());
  });

  it("prunes off-board directions at an edge", () => {
    const state = board([["A5", "white", "infantry"]]);
    const destinations = legalDestinations(state, { column: "A", row: 5 });
    expect(sortedKeys(destinations)).toEqual(["A4", "A6", "B5"].sort());
  });

  it("excludes an adjacent lake square as a destination", () => {
    // A6 is not itself a lake (column A is not a lake column), but its
    // neighbor B6 is (lake columns B, C, F, G, J, K on rows 6-7).
    const state = board([["A6", "white", "infantry"]]);
    const destinations = legalDestinations(state, { column: "A", row: 6 });
    expect(sortedKeys(destinations)).toEqual(["A5", "A7"].sort());
    expect(destinations.some((s) => s.column === "B" && s.row === 6)).toBe(
      false,
    );
  });

  it("excludes an adjacent square occupied by a friendly piece", () => {
    const state = board([
      ["D5", "white", "infantry"],
      ["D6", "white", "militia"],
    ]);
    const destinations = legalDestinations(state, { column: "D", row: 5 });
    expect(sortedKeys(destinations)).toEqual(["C5", "D4", "E5"].sort());
  });

  it("excludes an adjacent square occupied by an enemy piece", () => {
    const state = board([
      ["D5", "white", "infantry"],
      ["D6", "black", "militia"],
    ]);
    const destinations = legalDestinations(state, { column: "D", row: 5 });
    expect(sortedKeys(destinations)).toEqual(["C5", "D4", "E5"].sort());
  });

  it("gives Tower no destinations", () => {
    const state = board([["A1", "white", "tower"]]);
    expect(legalDestinations(state, { column: "A", row: 1 })).toEqual([]);
  });

  it("gives Flag no destinations", () => {
    const state = board([["A1", "white", "flag"]]);
    expect(legalDestinations(state, { column: "A", row: 1 })).toEqual([]);
  });

  it("gives no destinations for an empty origin square", () => {
    const state = board([]);
    expect(legalDestinations(state, { column: "D", row: 5 })).toEqual([]);
  });

  it("never returns a diagonal destination", () => {
    const state = board([["E9", "black", "skirmisher"]]);
    const destinations = legalDestinations(state, { column: "E", row: 9 });
    for (const destination of destinations) {
      const sameColumn = destination.column === "E";
      const sameRow = destination.row === 9;
      // Exactly one of column/row must match the origin - never both
      // different (diagonal) and never both the same (the origin itself).
      expect(sameColumn !== sameRow).toBe(true);
    }
  });

  it("lets a Skirmisher reach up to 3 squares in a clear straight line, in every direction", () => {
    const state = board([["E9", "black", "skirmisher"]]);
    const destinations = legalDestinations(state, { column: "E", row: 9 });
    expect(sortedKeys(destinations)).toEqual(
      [
        "E6",
        "E7",
        "E8", // up
        "E10",
        "E11",
        "E12", // down
        "B9",
        "C9",
        "D9", // left
        "F9",
        "G9",
        "H9", // right
      ].sort(),
    );
  });

  it("stops a Skirmisher's ray short when it would enter a lake, excluding the lake square", () => {
    // C is a lake column; C6 and C7 are lake squares. From C9 moving toward
    // row 1, C8 (distance 1) is clear, C7 (distance 2) is a lake.
    const state = board([["C9", "black", "skirmisher"]]);
    const destinations = legalDestinations(state, { column: "C", row: 9 });
    const upward = destinations.filter((s) => s.column === "C" && s.row < 9);
    expect(sortedKeys(upward)).toEqual(["C8"]);
  });

  it("stops a Skirmisher's ray short when blocked by a piece, excluding the blocker and everything past it", () => {
    const state = board([
      ["H5", "white", "skirmisher"],
      ["J5", "black", "militia"], // blocker at distance 2 to the right
    ]);
    const destinations = legalDestinations(state, { column: "H", row: 5 });
    const rightward = destinations.filter(
      (s) => s.row === 5 && s.column > "H",
    );
    expect(sortedKeys(rightward)).toEqual(["I5"]);
    expect(rightward.some((s) => s.column === "J" || s.column === "K")).toBe(
      false,
    );
  });

  it("lets a Skirmisher reach exactly 1 square when blocked immediately", () => {
    const state = board([
      ["H5", "white", "skirmisher"],
      ["I5", "black", "militia"], // blocker at distance 1
    ]);
    const destinations = legalDestinations(state, { column: "H", row: 5 });
    const rightward = destinations.filter((s) => s.row === 5 && s.column > "H");
    expect(rightward).toEqual([]);
  });

  it("lets a Skirmisher reach exactly 2 squares when blocked at distance 3", () => {
    const state = board([
      ["E9", "black", "skirmisher"],
      ["H9", "black", "militia"], // friendly blocker at distance 3
    ]);
    const destinations = legalDestinations(state, { column: "E", row: 9 });
    const rightward = destinations.filter((s) => s.row === 9 && s.column > "E");
    expect(sortedKeys(rightward)).toEqual(["F9", "G9"].sort());
  });

  it("limits a Knight moving without attacking to one square, like a baseline piece", () => {
    const state = board([["D5", "white", "knight"]]);
    const destinations = legalDestinations(state, { column: "D", row: 5 });
    expect(sortedKeys(destinations)).toEqual(["C5", "D4", "D6", "E5"].sort());
  });
});

describe("hasAnyLegalMove", () => {
  it("is true when at least one of the side's pieces has a legal destination", () => {
    const state = board([["D5", "white", "infantry"]]);
    expect(hasAnyLegalMove(state, "white")).toBe(true);
  });

  it("is false for a side with no pieces on the board", () => {
    const state = board([["D5", "black", "infantry"]]);
    expect(hasAnyLegalMove(state, "white")).toBe(false);
  });
});

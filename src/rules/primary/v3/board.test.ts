import { describe, expect, it } from "vitest";
import {
  allSquares,
  BLACK_HOME_ROWS,
  COLUMNS,
  homeSquares,
  isHomeSquareFor,
  isOnBoard,
  LEFT_HALF_COLUMNS,
  RIGHT_HALF_COLUMNS,
  ROWS,
  squareKey,
  stepFrom,
  WHITE_HOME_ROWS,
  type Square,
} from "./board.ts";

describe("board geometry (ruleset major 3)", () => {
  it("has 8 columns (A-H) and 8 rows (1-8)", () => {
    expect(COLUMNS).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(ROWS).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("has 64 squares total, one per column/row combination, every one open", () => {
    const squares = allSquares();
    expect(squares).toHaveLength(64);
    const keys = new Set(squares.map(squareKey));
    expect(keys.size).toBe(64);
  });

  it("has no terrain concept - isOnBoard is the only bound", () => {
    expect(isOnBoard("A", 1)).toBe(true);
    expect(isOnBoard("H", 8)).toBe(true);
    expect(isOnBoard("I", 1)).toBe(false);
    expect(isOnBoard("A", 9)).toBe(false);
    expect(isOnBoard("A", 0)).toBe(false);
  });

  it("has White's home rows as 1-2 and Black's as 7-8", () => {
    expect(WHITE_HOME_ROWS).toEqual([1, 2]);
    expect(BLACK_HOME_ROWS).toEqual([7, 8]);
  });

  it("classifies each side's home area as 16 squares - exactly one army", () => {
    expect(homeSquares("white")).toHaveLength(16);
    expect(homeSquares("black")).toHaveLength(16);
    for (const square of homeSquares("white")) {
      expect(isHomeSquareFor(square, "white")).toBe(true);
      expect(isHomeSquareFor(square, "black")).toBe(false);
    }
    for (const square of homeSquares("black")) {
      expect(isHomeSquareFor(square, "black")).toBe(true);
      expect(isHomeSquareFor(square, "white")).toBe(false);
    }
  });

  it("splits the board into a left half (A-D) and right half (E-H), each four columns", () => {
    expect(LEFT_HALF_COLUMNS).toEqual(["A", "B", "C", "D"]);
    expect(RIGHT_HALF_COLUMNS).toEqual(["E", "F", "G", "H"]);
  });

  it("keeps the step helper on the board at every edge", () => {
    const corner: Square = { column: "A", row: 1 };
    expect(stepFrom(corner, "south")).toBeNull();
    expect(stepFrom(corner, "west")).toBeNull();
    expect(stepFrom(corner, "southwest")).toBeNull();
    expect(stepFrom(corner, "north")).toEqual({ column: "A", row: 2 });
    expect(stepFrom(corner, "east")).toEqual({ column: "B", row: 1 });
    expect(stepFrom(corner, "northeast")).toEqual({ column: "B", row: 2 });

    const farCorner: Square = { column: "H", row: 8 };
    expect(stepFrom(farCorner, "north")).toBeNull();
    expect(stepFrom(farCorner, "east")).toBeNull();
    expect(stepFrom(farCorner, "northeast")).toBeNull();
    expect(stepFrom(farCorner, "south")).toEqual({ column: "H", row: 7 });
    expect(stepFrom(farCorner, "west")).toEqual({ column: "G", row: 8 });
    expect(stepFrom(farCorner, "southwest")).toEqual({ column: "G", row: 7 });

    const middle: Square = { column: "D", row: 4 };
    expect(stepFrom(middle, "north")).toEqual({ column: "D", row: 5 });
    expect(stepFrom(middle, "south")).toEqual({ column: "D", row: 3 });
    expect(stepFrom(middle, "east")).toEqual({ column: "E", row: 4 });
    expect(stepFrom(middle, "west")).toEqual({ column: "C", row: 4 });
  });
});

import { describe, expect, it } from "vitest";
import {
  allSquares,
  COLUMNS,
  homeSquares,
  isHomeSquareFor,
  isLake,
  regionOf,
  ROWS,
  squareKey,
  type Column,
  type Row,
} from "./board.ts";

const LAKE_COLUMN_PAIRS: readonly [Column, Column][] = [
  ["B", "C"],
  ["F", "G"],
  ["J", "K"],
];

describe("board geometry (ruleset PRIMARY:1.1)", () => {
  it("has 144 squares total, one per column/row combination", () => {
    expect(allSquares()).toHaveLength(12 * 12);
  });

  it("has exactly 12 lake squares: columns B, C, F, G, J, K on rows 6 and 7", () => {
    const lakeSquares = allSquares().filter(isLake);
    expect(lakeSquares).toHaveLength(12);

    const lakeKeys = new Set(lakeSquares.map(squareKey));
    for (const row of [6, 7] as const) {
      for (const column of ["B", "C", "F", "G", "J", "K"] as const) {
        expect(lakeKeys.has(`${column}${row}`)).toBe(true);
      }
    }
  });

  it("forms three separate 2x2 lakes at B-C, F-G, and J-K across rows 6-7", () => {
    for (const [left, right] of LAKE_COLUMN_PAIRS) {
      for (const row of [6, 7] as const) {
        expect(isLake({ column: left, row })).toBe(true);
        expect(isLake({ column: right, row })).toBe(true);
      }
    }

    // The columns between/around the lakes are not lake squares, on rows 6-7,
    // which keeps the three lakes visually and structurally separate.
    const nonLakeColumns: Column[] = ["A", "D", "E", "H", "I", "L"];
    for (const row of [6, 7] as const) {
      for (const column of nonLakeColumns) {
        expect(isLake({ column, row })).toBe(false);
      }
    }
  });

  it("has no lake squares outside rows 6 and 7", () => {
    for (const row of ROWS) {
      if (row === 6 || row === 7) continue;
      for (const column of COLUMNS) {
        expect(isLake({ column, row })).toBe(false);
      }
    }
  });

  it("classifies rows 1-4 as White home and rows 9-12 as Black home", () => {
    for (const row of [1, 2, 3, 4] as const) {
      for (const column of COLUMNS) {
        expect(regionOf({ column, row })).toBe("white-home");
      }
    }
    for (const row of [9, 10, 11, 12] as const) {
      for (const column of COLUMNS) {
        expect(regionOf({ column, row })).toBe("black-home");
      }
    }
  });

  it("classifies rows 5 and 8 as buffer", () => {
    for (const row of [5, 8] as const) {
      for (const column of COLUMNS) {
        expect(regionOf({ column, row })).toBe("buffer");
      }
    }
  });

  it("classifies the non-lake squares on rows 6-7 as buffer", () => {
    const nonLakeColumns: Column[] = ["A", "D", "E", "H", "I", "L"];
    for (const row of [6, 7] as const) {
      for (const column of nonLakeColumns) {
        expect(regionOf({ column, row })).toBe("buffer");
      }
    }
  });

  it("gives each side exactly 48 home squares", () => {
    expect(homeSquares("white")).toHaveLength(48);
    expect(homeSquares("black")).toHaveLength(48);
  });

  it("only reports home squares within the side's own rows", () => {
    for (const square of homeSquares("white")) {
      expect([1, 2, 3, 4]).toContain(square.row satisfies Row);
    }
    for (const square of homeSquares("black")) {
      expect([9, 10, 11, 12]).toContain(square.row satisfies Row);
    }
  });

  it("isHomeSquareFor agrees with regionOf and does not cross sides", () => {
    for (const square of allSquares()) {
      const region = regionOf(square);
      expect(isHomeSquareFor(square, "white")).toBe(region === "white-home");
      expect(isHomeSquareFor(square, "black")).toBe(region === "black-home");
    }
  });

  it("produces a stable, human-readable key per square", () => {
    expect(squareKey({ column: "A", row: 1 })).toBe("A1");
    expect(squareKey({ column: "L", row: 12 })).toBe("L12");
  });
});

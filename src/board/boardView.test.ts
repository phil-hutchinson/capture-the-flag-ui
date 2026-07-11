import { describe, expect, it } from "vitest";
import { fullBoardRows, visibleColumns, visibleRows } from "./boardView.ts";

describe("visibleRows", () => {
  it("shows White's 4 home rows, the buffer row, and the full near lake row, back rank last", () => {
    const rows = visibleRows("white");
    expect(rows.map((r) => r.row)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(rows.map((r) => r.band)).toEqual([
      "lake-row",
      "buffer",
      "home",
      "home",
      "home",
      "home",
    ]);
    // Back rank (row 1) is last, i.e. nearest the player at the bottom.
    expect(rows.at(-1)).toEqual({ row: 1, band: "home" });
  });

  it("shows Black's 4 home rows, the buffer row, and the full near lake row, back rank last", () => {
    const rows = visibleRows("black");
    expect(rows.map((r) => r.row)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(rows.map((r) => r.band)).toEqual([
      "lake-row",
      "buffer",
      "home",
      "home",
      "home",
      "home",
    ]);
    expect(rows.at(-1)).toEqual({ row: 12, band: "home" });
  });

  it("never includes the opponent's home rows", () => {
    const whiteRows = visibleRows("white").map((r) => r.row);
    const blackRows = visibleRows("black").map((r) => r.row);
    expect(whiteRows.some((row) => row >= 9)).toBe(false);
    expect(blackRows.some((row) => row <= 4)).toBe(false);
  });
});

describe("visibleColumns", () => {
  it("runs left-to-right A...L for White (un-rotated)", () => {
    expect(visibleColumns("white")).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
    ]);
  });

  it("runs left-to-right L...A for Black (180 degree rotation)", () => {
    expect(visibleColumns("black")).toEqual([
      "L",
      "K",
      "J",
      "I",
      "H",
      "G",
      "F",
      "E",
      "D",
      "C",
      "B",
      "A",
    ]);
  });
});

describe("fullBoardRows", () => {
  it("runs top-to-bottom 12...1 for White, back rank (row 1) nearest at the bottom", () => {
    expect(fullBoardRows("white")).toEqual([
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ]);
  });

  it("runs top-to-bottom 1...12 for Black, back rank (row 12) nearest at the bottom", () => {
    expect(fullBoardRows("black")).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("includes every row exactly once for each side", () => {
    for (const side of ["white", "black"] as const) {
      const rows = fullBoardRows(side);
      expect(rows).toHaveLength(12);
      expect(new Set(rows).size).toBe(12);
      expect([...rows].sort((a, b) => a - b)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
      ]);
    }
  });

  it("covers all 144 squares exactly once when paired with visibleColumns, per side", () => {
    for (const side of ["white", "black"] as const) {
      const rows = fullBoardRows(side);
      const columns = visibleColumns(side);
      const keys = new Set<string>();
      for (const row of rows) {
        for (const column of columns) {
          keys.add(`${column}${row}`);
        }
      }
      expect(keys.size).toBe(144);
    }
  });

  it("pairs with visibleColumns per side: A...L for White, L...A for Black", () => {
    expect(visibleColumns("white")).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
    ]);
    expect(visibleColumns("black")).toEqual([
      "L",
      "K",
      "J",
      "I",
      "H",
      "G",
      "F",
      "E",
      "D",
      "C",
      "B",
      "A",
    ]);
  });
});

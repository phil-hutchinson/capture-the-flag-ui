import { describe, expect, it } from "vitest";
import { BOARD_LAYOUTS } from "../rules/primary/v2/boardLayout.ts";
import {
  fullBoardDisplayPosition,
  fullBoardRows,
  movePathSquares,
  visibleColumns,
  visibleRows,
} from "./boardView.ts";

/** Skirmish's 8x8, no-buffer layout (story 00000023's Step 2 registry). */
const SKIRMISH_LAYOUT = BOARD_LAYOUTS.standard_64;

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

describe("fullBoardDisplayPosition", () => {
  it("places White's own back-rank corner (A1) at the bottom-left cell", () => {
    expect(fullBoardDisplayPosition("white", { column: "A", row: 1 })).toEqual({
      row: 11,
      column: 0,
    });
  });

  it("places White's far corner (L12) at the top-right cell", () => {
    expect(fullBoardDisplayPosition("white", { column: "L", row: 12 })).toEqual(
      { row: 0, column: 11 },
    );
  });

  it("places Black's own back-rank corner (L12) at the bottom-left cell", () => {
    expect(fullBoardDisplayPosition("black", { column: "L", row: 12 })).toEqual(
      { row: 11, column: 0 },
    );
  });

  it("places Black's far corner (A1) at the top-right cell", () => {
    expect(fullBoardDisplayPosition("black", { column: "A", row: 1 })).toEqual({
      row: 0,
      column: 11,
    });
  });

  it("agrees with fullBoardRows/visibleColumns for an arbitrary square, both sides", () => {
    const square = { column: "F", row: 7 } as const;
    for (const side of ["white", "black"] as const) {
      const position = fullBoardDisplayPosition(side, square);
      expect(position.row).toBe(fullBoardRows(side).indexOf(square.row));
      expect(position.column).toBe(visibleColumns(side).indexOf(square.column));
    }
  });
});

describe("movePathSquares", () => {
  it("returns just from/to for a one-square horizontal move", () => {
    expect(
      movePathSquares({ column: "D", row: 4 }, { column: "E", row: 4 }),
    ).toEqual([
      { column: "D", row: 4 },
      { column: "E", row: 4 },
    ]);
  });

  it("returns just from/to for a one-square vertical move", () => {
    expect(
      movePathSquares({ column: "D", row: 4 }, { column: "D", row: 5 }),
    ).toEqual([
      { column: "D", row: 4 },
      { column: "D", row: 5 },
    ]);
  });

  it("includes the in-between square for a two-square horizontal move", () => {
    expect(
      movePathSquares({ column: "D", row: 4 }, { column: "F", row: 4 }),
    ).toEqual([
      { column: "D", row: 4 },
      { column: "E", row: 4 },
      { column: "F", row: 4 },
    ]);
  });

  it("includes the in-between square for a two-square vertical move", () => {
    expect(
      movePathSquares({ column: "D", row: 4 }, { column: "D", row: 6 }),
    ).toEqual([
      { column: "D", row: 4 },
      { column: "D", row: 5 },
      { column: "D", row: 6 },
    ]);
  });

  it("handles a two-square move in the decreasing direction, both axes", () => {
    expect(
      movePathSquares({ column: "F", row: 4 }, { column: "D", row: 4 }),
    ).toEqual([
      { column: "F", row: 4 },
      { column: "E", row: 4 },
      { column: "D", row: 4 },
    ]);
    expect(
      movePathSquares({ column: "D", row: 6 }, { column: "D", row: 4 }),
    ).toEqual([
      { column: "D", row: 6 },
      { column: "D", row: 5 },
      { column: "D", row: 4 },
    ]);
  });

  it("returns just from/to for a one-square diagonal move (story 00000023's diagonal attacks)", () => {
    expect(
      movePathSquares({ column: "G", row: 7 }, { column: "H", row: 8 }),
    ).toEqual([
      { column: "G", row: 7 },
      { column: "H", row: 8 },
    ]);
  });

  it("works past Battle's 12-column width - a Skirmish-sized two-square move", () => {
    // Skirmish is only 8 columns wide (A-H); this proves the column
    // arithmetic no longer depends on Battle's fixed A-L column list.
    expect(
      movePathSquares({ column: "H", row: 1 }, { column: "F", row: 1 }),
    ).toEqual([
      { column: "H", row: 1 },
      { column: "G", row: 1 },
      { column: "F", row: 1 },
    ]);
  });
});

describe("visibleRows on the Skirmish layout (no buffer)", () => {
  it("shows White's 3 home rows and the near lake row, with no buffer band", () => {
    const rows = visibleRows("white", SKIRMISH_LAYOUT);
    expect(rows.map((r) => r.row)).toEqual([4, 3, 2, 1]);
    expect(rows.map((r) => r.band)).toEqual([
      "lake-row",
      "home",
      "home",
      "home",
    ]);
    expect(rows.some((r) => r.band === "buffer")).toBe(false);
    expect(rows.at(-1)).toEqual({ row: 1, band: "home" });
  });

  it("shows Black's 3 home rows and the near lake row, with no buffer band", () => {
    const rows = visibleRows("black", SKIRMISH_LAYOUT);
    expect(rows.map((r) => r.row)).toEqual([5, 6, 7, 8]);
    expect(rows.map((r) => r.band)).toEqual([
      "lake-row",
      "home",
      "home",
      "home",
    ]);
    expect(rows.some((r) => r.band === "buffer")).toBe(false);
    expect(rows.at(-1)).toEqual({ row: 8, band: "home" });
  });
});

describe("visibleColumns on the Skirmish layout", () => {
  it("runs left-to-right A...H for White (un-rotated)", () => {
    expect(visibleColumns("white", SKIRMISH_LAYOUT)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
    ]);
  });

  it("runs left-to-right H...A for Black (180 degree rotation)", () => {
    expect(visibleColumns("black", SKIRMISH_LAYOUT)).toEqual([
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

describe("fullBoardRows on the Skirmish layout", () => {
  it("runs top-to-bottom 8...1 for White, back rank (row 1) nearest at the bottom", () => {
    expect(fullBoardRows("white", SKIRMISH_LAYOUT)).toEqual([
      8, 7, 6, 5, 4, 3, 2, 1,
    ]);
  });

  it("runs top-to-bottom 1...8 for Black, back rank (row 8) nearest at the bottom", () => {
    expect(fullBoardRows("black", SKIRMISH_LAYOUT)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it("covers all 64 squares exactly once when paired with visibleColumns, per side", () => {
    for (const side of ["white", "black"] as const) {
      const rows = fullBoardRows(side, SKIRMISH_LAYOUT);
      const columns = visibleColumns(side, SKIRMISH_LAYOUT);
      const keys = new Set<string>();
      for (const row of rows) {
        for (const column of columns) {
          keys.add(`${column}${row}`);
        }
      }
      expect(keys.size).toBe(64);
    }
  });
});

describe("fullBoardDisplayPosition on the Skirmish layout", () => {
  it("places White's own back-rank corner (A1) at the bottom-left cell", () => {
    expect(
      fullBoardDisplayPosition(
        "white",
        { column: "A", row: 1 },
        SKIRMISH_LAYOUT,
      ),
    ).toEqual({ row: 7, column: 0 });
  });

  it("places White's far corner (H8) at the top-right cell", () => {
    expect(
      fullBoardDisplayPosition(
        "white",
        { column: "H", row: 8 },
        SKIRMISH_LAYOUT,
      ),
    ).toEqual({ row: 0, column: 7 });
  });

  it("places Black's own back-rank corner (H8) at the bottom-left cell", () => {
    expect(
      fullBoardDisplayPosition(
        "black",
        { column: "H", row: 8 },
        SKIRMISH_LAYOUT,
      ),
    ).toEqual({ row: 7, column: 0 });
  });

  it("places Black's far corner (A1) at the top-right cell", () => {
    expect(
      fullBoardDisplayPosition(
        "black",
        { column: "A", row: 1 },
        SKIRMISH_LAYOUT,
      ),
    ).toEqual({ row: 0, column: 7 });
  });
});

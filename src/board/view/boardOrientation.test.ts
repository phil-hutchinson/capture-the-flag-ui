import { describe, expect, it } from "vitest";
import {
  fullBoardDisplayPosition,
  fullBoardRows,
  movePathSquares,
  fullBoardColumns,
} from "./boardOrientation.ts";
import type { BoardGeometry } from "./viewModel.ts";

/**
 * These fixtures deliberately mirror major 2's Battle (12x12) and Skirmish
 * (8x8) dimensions - the same two sizes `boardView.test.ts` covered before
 * this story - but are built as plain `BoardGeometry` literals, not derived
 * from any `BoardLayout`, so this test file stays as major-agnostic as the
 * module it covers.
 */
const BATTLE_GEOMETRY: BoardGeometry = {
  columnCount: 12,
  rowCount: 12,
  impassableSquares: new Set(),
};

const SKIRMISH_GEOMETRY: BoardGeometry = {
  columnCount: 8,
  rowCount: 8,
  impassableSquares: new Set(),
};

describe("fullBoardRows", () => {
  it("runs top-to-bottom 12...1 for White, back rank (row 1) nearest at the bottom", () => {
    expect(fullBoardRows("white", BATTLE_GEOMETRY)).toEqual([
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ]);
  });

  it("runs top-to-bottom 1...12 for Black, back rank (row 12) nearest at the bottom", () => {
    expect(fullBoardRows("black", BATTLE_GEOMETRY)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("includes every row exactly once for each side", () => {
    for (const side of ["white", "black"] as const) {
      const rows = fullBoardRows(side, BATTLE_GEOMETRY);
      expect(rows).toHaveLength(12);
      expect(new Set(rows).size).toBe(12);
      expect([...rows].sort((a, b) => a - b)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
      ]);
    }
  });

  it("covers all 144 squares exactly once when paired with fullBoardColumns, per side", () => {
    for (const side of ["white", "black"] as const) {
      const rows = fullBoardRows(side, BATTLE_GEOMETRY);
      const columns = fullBoardColumns(side, BATTLE_GEOMETRY);
      const keys = new Set<string>();
      for (const row of rows) {
        for (const column of columns) {
          keys.add(`${column}${row}`);
        }
      }
      expect(keys.size).toBe(144);
    }
  });

  it("runs top-to-bottom 8...1 for White on an 8x8 geometry", () => {
    expect(fullBoardRows("white", SKIRMISH_GEOMETRY)).toEqual([
      8, 7, 6, 5, 4, 3, 2, 1,
    ]);
  });

  it("runs top-to-bottom 1...8 for Black on an 8x8 geometry", () => {
    expect(fullBoardRows("black", SKIRMISH_GEOMETRY)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });
});

describe("fullBoardColumns", () => {
  it("runs left-to-right A...L for White (un-rotated)", () => {
    expect(fullBoardColumns("white", BATTLE_GEOMETRY)).toEqual([
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
    expect(fullBoardColumns("black", BATTLE_GEOMETRY)).toEqual([
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

  it("runs left-to-right A...H for White on an 8x8 geometry", () => {
    expect(fullBoardColumns("white", SKIRMISH_GEOMETRY)).toEqual([
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

  it("runs left-to-right H...A for Black on an 8x8 geometry", () => {
    expect(fullBoardColumns("black", SKIRMISH_GEOMETRY)).toEqual([
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
    expect(
      fullBoardDisplayPosition(
        "white",
        { column: "A", row: 1 },
        BATTLE_GEOMETRY,
      ),
    ).toEqual({ row: 11, column: 0 });
  });

  it("places White's far corner (L12) at the top-right cell", () => {
    expect(
      fullBoardDisplayPosition(
        "white",
        { column: "L", row: 12 },
        BATTLE_GEOMETRY,
      ),
    ).toEqual({ row: 0, column: 11 });
  });

  it("places Black's own back-rank corner (L12) at the bottom-left cell", () => {
    expect(
      fullBoardDisplayPosition(
        "black",
        { column: "L", row: 12 },
        BATTLE_GEOMETRY,
      ),
    ).toEqual({ row: 11, column: 0 });
  });

  it("places Black's far corner (A1) at the top-right cell", () => {
    expect(
      fullBoardDisplayPosition(
        "black",
        { column: "A", row: 1 },
        BATTLE_GEOMETRY,
      ),
    ).toEqual({ row: 0, column: 11 });
  });

  it("agrees with fullBoardRows/fullBoardColumns for an arbitrary square, both sides", () => {
    const square = { column: "F", row: 7 } as const;
    for (const side of ["white", "black"] as const) {
      const position = fullBoardDisplayPosition(side, square, BATTLE_GEOMETRY);
      expect(position.row).toBe(
        fullBoardRows(side, BATTLE_GEOMETRY).indexOf(square.row),
      );
      expect(position.column).toBe(
        fullBoardColumns(side, BATTLE_GEOMETRY).indexOf(square.column),
      );
    }
  });

  it("places White's own back-rank corner (A1) at the bottom-left cell on an 8x8 geometry", () => {
    expect(
      fullBoardDisplayPosition(
        "white",
        { column: "A", row: 1 },
        SKIRMISH_GEOMETRY,
      ),
    ).toEqual({ row: 7, column: 0 });
  });

  it("places White's far corner (H8) at the top-right cell on an 8x8 geometry", () => {
    expect(
      fullBoardDisplayPosition(
        "white",
        { column: "H", row: 8 },
        SKIRMISH_GEOMETRY,
      ),
    ).toEqual({ row: 0, column: 7 });
  });

  it("places Black's own back-rank corner (H8) at the bottom-left cell on an 8x8 geometry", () => {
    expect(
      fullBoardDisplayPosition(
        "black",
        { column: "H", row: 8 },
        SKIRMISH_GEOMETRY,
      ),
    ).toEqual({ row: 7, column: 0 });
  });

  it("places Black's far corner (A1) at the top-right cell on an 8x8 geometry", () => {
    expect(
      fullBoardDisplayPosition(
        "black",
        { column: "A", row: 1 },
        SKIRMISH_GEOMETRY,
      ),
    ).toEqual({ row: 0, column: 7 });
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

  it("returns just from/to for a one-square diagonal move", () => {
    expect(
      movePathSquares({ column: "G", row: 7 }, { column: "H", row: 8 }),
    ).toEqual([
      { column: "G", row: 7 },
      { column: "H", row: 8 },
    ]);
  });

  it("works past a 12-column width - an 8-column-wide two-square move", () => {
    // Proves the column arithmetic doesn't depend on any fixed column list.
    expect(
      movePathSquares({ column: "H", row: 1 }, { column: "F", row: 1 }),
    ).toEqual([
      { column: "H", row: 1 },
      { column: "G", row: 1 },
      { column: "F", row: 1 },
    ]);
  });
});

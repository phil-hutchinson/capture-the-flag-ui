import { describe, expect, it } from "vitest";
import { BOARD_LAYOUTS } from "./boardLayout.ts";
import {
  allSquares,
  COLUMNS,
  homeSquares,
  homeSquaresFacingLane,
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

describe("board geometry (ruleset major 2, Battle - the default BoardLayout)", () => {
  it("has 144 squares total, one per column/row combination", () => {
    expect(allSquares()).toHaveLength(12 * 12);
  });

  it("has exactly 12 lake squares: columns B, C, F, G, J, K on rows 6 and 7", () => {
    const lakeSquares = allSquares().filter((square) => isLake(square));
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

  it("has no home square facing a lane on Battle - the neutral buffer keeps every home square off a lake row", () => {
    expect(homeSquaresFacingLane("white")).toEqual([]);
    expect(homeSquaresFacingLane("black")).toEqual([]);
  });
});

// Story 00000023, Step 3: the same geometry functions above, exercised on
// the Skirmish layout (`standard_64`) instead of the Battle default, to
// confirm they are genuinely parametric over `BoardLayout` rather than
// hardcoding Battle's 12x12 grid.
describe("board geometry (ruleset 2-0:SKIRMISH, an explicit BoardLayout)", () => {
  const SKIRMISH = BOARD_LAYOUTS.standard_64;
  const SKIRMISH_LAKE_COLUMN_PAIRS: readonly [Column, Column][] = [
    ["B", "C"],
    ["F", "G"],
  ];

  it("has 64 squares total, one per column/row combination", () => {
    expect(allSquares(SKIRMISH)).toHaveLength(8 * 8);
  });

  it("has exactly 8 lake squares: columns B, C, F, G on rows 4 and 5", () => {
    const lakeSquares = allSquares(SKIRMISH).filter((square) =>
      isLake(square, SKIRMISH),
    );
    expect(lakeSquares).toHaveLength(8);

    const lakeKeys = new Set(lakeSquares.map(squareKey));
    for (const row of [4, 5] as const) {
      for (const column of ["B", "C", "F", "G"] as const) {
        expect(lakeKeys.has(`${column}${row}`)).toBe(true);
      }
    }
  });

  it("forms two separate 2x2 lakes at B-C and F-G across rows 4-5", () => {
    for (const [left, right] of SKIRMISH_LAKE_COLUMN_PAIRS) {
      for (const row of [4, 5] as const) {
        expect(isLake({ column: left, row }, SKIRMISH)).toBe(true);
        expect(isLake({ column: right, row }, SKIRMISH)).toBe(true);
      }
    }

    const nonLakeColumns: Column[] = ["A", "D", "E", "H"];
    for (const row of [4, 5] as const) {
      for (const column of nonLakeColumns) {
        expect(isLake({ column, row }, SKIRMISH)).toBe(false);
      }
    }
  });

  it("has no lake squares outside rows 4 and 5", () => {
    for (const row of [1, 2, 3, 6, 7, 8] as const) {
      for (const column of ["A", "B", "C", "D", "E", "F", "G", "H"] as const) {
        expect(isLake({ column, row }, SKIRMISH)).toBe(false);
      }
    }
  });

  it("has no neutral buffer: row 3 (White home) sits directly against row 4 (lake), row 6 (Black home) directly against row 5 (lake)", () => {
    // Unlike Battle - which has two entirely-buffer rows (5 and 8) between
    // each home zone and the lake rows - Skirmish has none: home immediately
    // gives way to a lake row. The lake rows still carry their own non-lake
    // "O" columns (A, D, E, H), exactly like Battle's - those remain a
    // neutral, non-home region ("buffer"), just as on Battle; what Skirmish
    // lacks is a *whole row* that is buffer everywhere, the way Battle's rows
    // 5 and 8 are.
    for (const row of [1, 2, 3] as const) {
      expect(regionOf({ column: "A", row }, SKIRMISH)).toBe("white-home");
    }
    for (const row of [6, 7, 8] as const) {
      expect(regionOf({ column: "A", row }, SKIRMISH)).toBe("black-home");
    }
    for (const row of SKIRMISH.lakeRows) {
      for (const column of ["A", "D", "E", "H"] as const) {
        expect(regionOf({ column, row }, SKIRMISH)).toBe("buffer");
      }
    }
    // No row on this layout is entirely buffer (unlike Battle's rows 5/8).
    for (let row = 1; row <= SKIRMISH.rowCount; row += 1) {
      const regions = ["A", "B", "C", "D", "E", "F", "G", "H"].map((column) =>
        regionOf({ column, row }, SKIRMISH),
      );
      expect(regions.every((region) => region === "buffer")).toBe(false);
    }
  });

  it("gives each side exactly 24 home squares", () => {
    expect(homeSquares("white", SKIRMISH)).toHaveLength(24);
    expect(homeSquares("black", SKIRMISH)).toHaveLength(24);
  });

  it("only reports home squares within the side's own rows", () => {
    for (const square of homeSquares("white", SKIRMISH)) {
      expect([1, 2, 3]).toContain(square.row);
    }
    for (const square of homeSquares("black", SKIRMISH)) {
      expect([6, 7, 8]).toContain(square.row);
    }
  });

  it("isHomeSquareFor agrees with regionOf and does not cross sides", () => {
    for (const square of allSquares(SKIRMISH)) {
      const region = regionOf(square, SKIRMISH);
      expect(isHomeSquareFor(square, "white", SKIRMISH)).toBe(
        region === "white-home",
      );
      expect(isHomeSquareFor(square, "black", SKIRMISH)).toBe(
        region === "black-home",
      );
    }
  });

  it("does not disturb the Battle-default (no-argument) behavior", () => {
    // Calling the same functions with no layout argument still yields
    // Battle's geometry - the two boards don't leak into one another.
    expect(allSquares()).toHaveLength(144);
    expect(homeSquares("white")).toHaveLength(48);
  });

  // Story 00000025, Step 2: the geometric definition of "directly in front
  // of a lane" (rules Appendix A, TOWER_PLACEMENT) - a home square
  // orthogonally adjacent to a square that lies in a lake row and is not
  // itself a lake. Asserted by value, not just by size, and explicitly
  // checking that the squares behind the lakes (rather than the lanes) are
  // excluded.
  it("closes exactly A3, D3, E3, H3 for White - the squares directly in front of a lane", () => {
    expect(homeSquaresFacingLane("white", SKIRMISH)).toEqual([
      { column: "A", row: 3 },
      { column: "D", row: 3 },
      { column: "E", row: 3 },
      { column: "H", row: 3 },
    ]);
  });

  it("closes exactly A6, D6, E6, H6 for Black - the mirrored squares directly in front of a lane", () => {
    expect(homeSquaresFacingLane("black", SKIRMISH)).toEqual([
      { column: "A", row: 6 },
      { column: "D", row: 6 },
      { column: "E", row: 6 },
      { column: "H", row: 6 },
    ]);
  });

  it("does not close B3, C3, F3, G3 (or their Black counterparts) - those sit behind a lake, not a lane", () => {
    const white = homeSquaresFacingLane("white", SKIRMISH);
    const black = homeSquaresFacingLane("black", SKIRMISH);
    for (const column of ["B", "C", "F", "G"] as const) {
      expect(white).not.toContainEqual({ column, row: 3 });
      expect(black).not.toContainEqual({ column, row: 6 });
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  BOARD_LAYOUTS,
  columnLetter,
  homeZoneSize,
  lakeCells,
  rowRegion,
} from "./boardLayout.ts";

describe("standard_144 (Battle board layout)", () => {
  const layout = BOARD_LAYOUTS.standard_144;

  it("keys itself by its own id", () => {
    expect(layout.id).toBe("standard_144");
  });

  it("is a 12x12 board", () => {
    expect(layout.columnCount).toBe(12);
    expect(layout.rowCount).toBe(12);
  });

  it("has a 48-square home zone per side (4 rows deep, 12 columns wide)", () => {
    expect(layout.homeRowsPerSide).toBe(4);
    expect(homeZoneSize(layout)).toBe(48);
  });

  it("has a neutral buffer", () => {
    expect(layout.hasBuffer).toBe(true);
  });

  it("has exactly 12 lake cells forming three 2x2 lakes at B-C, F-G, J-K across rows 6-7", () => {
    const cells = lakeCells(layout);
    expect(cells).toHaveLength(12);

    const letters = new Set(
      cells.map((cell) => `${columnLetter(cell.columnIndex)}${cell.row}`),
    );
    for (const row of [6, 7]) {
      for (const column of ["B", "C", "F", "G", "J", "K"]) {
        expect(letters.has(`${column}${row}`)).toBe(true);
      }
    }
  });

  it("assigns rows 1-4 White home, row 5 buffer, rows 6-7 lake, row 8 buffer, rows 9-12 Black home", () => {
    for (const row of [1, 2, 3, 4]) {
      expect(rowRegion(layout, row)).toBe("white-home");
    }
    expect(rowRegion(layout, 5)).toBe("buffer");
    expect(rowRegion(layout, 6)).toBe("lake");
    expect(rowRegion(layout, 7)).toBe("lake");
    expect(rowRegion(layout, 8)).toBe("buffer");
    for (const row of [9, 10, 11, 12]) {
      expect(rowRegion(layout, row)).toBe("black-home");
    }
  });
});

describe("standard_64 (Skirmish board layout)", () => {
  const layout = BOARD_LAYOUTS.standard_64;

  it("keys itself by its own id", () => {
    expect(layout.id).toBe("standard_64");
  });

  it("is an 8x8 board", () => {
    expect(layout.columnCount).toBe(8);
    expect(layout.rowCount).toBe(8);
  });

  it("has a 24-square home zone per side (3 rows deep, 8 columns wide)", () => {
    expect(layout.homeRowsPerSide).toBe(3);
    expect(homeZoneSize(layout)).toBe(24);
  });

  it("has no neutral buffer", () => {
    expect(layout.hasBuffer).toBe(false);
  });

  it("has exactly 8 lake cells forming two 2x2 lakes at B-C, F-G across rows 4-5", () => {
    const cells = lakeCells(layout);
    expect(cells).toHaveLength(8);

    const letters = new Set(
      cells.map((cell) => `${columnLetter(cell.columnIndex)}${cell.row}`),
    );
    for (const row of [4, 5]) {
      for (const column of ["B", "C", "F", "G"]) {
        expect(letters.has(`${column}${row}`)).toBe(true);
      }
    }
  });

  it("assigns rows 1-3 White home, rows 4-5 lake, rows 6-8 Black home, with no buffer row", () => {
    for (const row of [1, 2, 3]) {
      expect(rowRegion(layout, row)).toBe("white-home");
    }
    expect(rowRegion(layout, 4)).toBe("lake");
    expect(rowRegion(layout, 5)).toBe("lake");
    for (const row of [6, 7, 8]) {
      expect(rowRegion(layout, row)).toBe("black-home");
    }

    // No row on this layout should ever classify as buffer - home zones sit
    // directly against the lake rows.
    for (let row = 1; row <= layout.rowCount; row++) {
      expect(rowRegion(layout, row)).not.toBe("buffer");
    }
  });
});

describe("columnLetter", () => {
  it("converts 0-based column indices to letters starting at A", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(1)).toBe("B");
    expect(columnLetter(11)).toBe("L");
    expect(columnLetter(25)).toBe("Z");
  });
});

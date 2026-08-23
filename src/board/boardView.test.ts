// Story 00000036, Step 11: the `fullBoardRows`/`fullBoardDisplayPosition`/
// `movePathSquares` coverage that used to live in this file moved to
// `src/board/view/boardOrientation.test.ts`, alongside the functions
// themselves (see `boardView.ts`'s own module comment). `visibleRows` and
// `visibleColumns` stay covered here - both remain major-2-only.

import { describe, expect, it } from "vitest";
import { BOARD_LAYOUTS } from "../rules/primary/v2/boardLayout.ts";
import { visibleColumns, visibleRows } from "./boardView.ts";

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

// Board layout configuration for the ruleset major-2 editions (`2-0:BATTLE` /
// `2-0:SKIRMISH`).
//
// A BoardLayout is pure geometry data, keyed by `BOARD_LAYOUT` per rules.md
// Appendix B / "editions and flags" (companion capture-the-flag repository,
// the single source of truth) and this story's implementation plan
// ("Grounding facts"). It describes a board's dimensions, its lake pattern,
// and each side's home-zone depth - the vocabulary the parametric board
// (a later step) threads through the rule engine.
//
// This module is not yet wired into `board.ts` or any consumer - it is inert
// data, unit-tested in isolation - so it has no dependencies elsewhere in the
// ruleset core.

/** Identifies one of the two published board geometries. */
export type BoardLayoutId = "standard_144" | "standard_64";

/** Which region a row belongs to, from White's edge to Black's. */
export type RowRegion = "white-home" | "black-home" | "buffer" | "lake";

/** One lake square, addressed by 0-based column index ("A" = 0) and 1-based row number. */
export interface LakeCell {
  readonly columnIndex: number;
  readonly row: number;
}

export interface BoardLayout {
  readonly id: BoardLayoutId;
  /** Number of columns, lettered from "A" (up to 26, per rules.md §2.1). */
  readonly columnCount: number;
  /** Number of rows, numbered from 1. Row 1 is White's back rank, the highest row is Black's. */
  readonly rowCount: number;
  /** How many rows deep each side's home zone is. */
  readonly homeRowsPerSide: number;
  /** True if a one-row neutral buffer separates each home zone from the lake rows. */
  readonly hasBuffer: boolean;
  /** 1-based row numbers that are lake rows. */
  readonly lakeRows: readonly number[];
  /** 0-based column indices ("A" = 0) that carry a lake square on every lake row. */
  readonly lakeColumnIndices: readonly number[];
}

/** Converts a 0-based column index to its letter, "A".."Z" (up to 26 columns). */
export function columnLetter(columnIndex: number): string {
  return String.fromCharCode("A".charCodeAt(0) + columnIndex);
}

/** The lake cells this layout describes, derived from its lake-column pattern applied across its lake rows. */
export function lakeCells(layout: BoardLayout): LakeCell[] {
  const cells: LakeCell[] = [];
  for (const row of layout.lakeRows) {
    for (const columnIndex of layout.lakeColumnIndices) {
      cells.push({ columnIndex, row });
    }
  }
  return cells;
}

/**
 * Classifies a row into its region: White's home zone, Black's, the neutral
 * buffer, or a lake row. Does not need to consult `hasBuffer` directly - a
 * layout with no buffer simply has no rows left between the home zones and
 * the lake rows, which falls out of the same arithmetic.
 */
export function rowRegion(layout: BoardLayout, row: number): RowRegion {
  if (layout.lakeRows.includes(row)) {
    return "lake";
  }
  if (row <= layout.homeRowsPerSide) {
    return "white-home";
  }
  if (row > layout.rowCount - layout.homeRowsPerSide) {
    return "black-home";
  }
  return "buffer";
}

/** Total home-zone squares for one side: columns wide by home-rows deep. */
export function homeZoneSize(layout: BoardLayout): number {
  return layout.columnCount * layout.homeRowsPerSide;
}

/**
 * Battle (`standard_144`): the existing 12x12 geometry, unchanged from major
 * 1. Rows 1-4 White home, row 5 buffer, rows 6-7 lake (three 2x2 lakes at
 * columns B-C, F-G, J-K), row 8 buffer, rows 9-12 Black home.
 */
const STANDARD_144: BoardLayout = {
  id: "standard_144",
  columnCount: 12,
  rowCount: 12,
  homeRowsPerSide: 4,
  hasBuffer: true,
  lakeRows: [6, 7],
  lakeColumnIndices: [1, 2, 5, 6, 9, 10], // B, C, F, G, J, K
};

/**
 * Skirmish (`standard_64`): an 8x8 board with no neutral buffer - home zones
 * sit directly against the lake rows. Rows 1-3 White home, rows 4-5 lake (two
 * 2x2 lakes at columns B-C, F-G), rows 6-8 Black home.
 */
const STANDARD_64: BoardLayout = {
  id: "standard_64",
  columnCount: 8,
  rowCount: 8,
  homeRowsPerSide: 3,
  hasBuffer: false,
  lakeRows: [4, 5],
  lakeColumnIndices: [1, 2, 5, 6], // B, C, F, G
};

/** Every `BOARD_LAYOUT` value, keyed by its id. */
export const BOARD_LAYOUTS: Readonly<Record<BoardLayoutId, BoardLayout>> = {
  standard_144: STANDARD_144,
  standard_64: STANDARD_64,
};

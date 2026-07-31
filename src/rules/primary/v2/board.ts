// Board geometry & terrain for ruleset PRIMARY:1.1.
//
// Coordinate frame per rules.md §4.4 (companion capture-the-flag repository,
// the single source of truth): columns A-L left-to-right, rows 1-12, where
// row 1 is White's back rank and row 12 is Black's back rank.
//
// Region layout, White edge -> Black edge:
//   Rows 1-4: White home zone (48 squares).
//   Row 5:    neutral buffer.
//   Rows 6-7: lake rows (three 2x2 lakes plus non-lake "O" squares).
//   Row 8:    neutral buffer.
//   Rows 9-12: Black home zone (48 squares).
//
// This module is pure geometry - it has no knowledge of pieces or placement
// - so it has no dependencies elsewhere in the ruleset core.

export type Column =
  "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";

export const COLUMNS: readonly Column[] = [
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
];

export type Row = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const ROWS: readonly Row[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Internal turn-order label for a player. Not player-facing (see side colors). */
export type Side = "white" | "black";

/** The other side. The one side-flip helper for every module in this ruleset version. */
export function otherSide(side: Side): Side {
  return side === "white" ? "black" : "white";
}

export interface Square {
  readonly column: Column;
  readonly row: Row;
}

export type Region = "white-home" | "black-home" | "buffer" | "lake";

/** Lake pattern on rows 6-7: `O L L O O L L O O L L O`, i.e. columns B, C, F, G, J, K. */
const LAKE_COLUMNS: ReadonlySet<Column> = new Set([
  "B",
  "C",
  "F",
  "G",
  "J",
  "K",
]);
const LAKE_ROWS: ReadonlySet<Row> = new Set([6, 7]);

const WHITE_HOME_ROWS: ReadonlySet<Row> = new Set([1, 2, 3, 4]);
const BLACK_HOME_ROWS: ReadonlySet<Row> = new Set([9, 10, 11, 12]);

/** A stable string key for a square, e.g. "A1". Useful as a Map/object key. */
export function squareKey(square: Square): string {
  return `${square.column}${square.row}`;
}

/** All 144 squares of the board, in no particular guaranteed order. */
export function allSquares(): Square[] {
  const squares: Square[] = [];
  for (const row of ROWS) {
    for (const column of COLUMNS) {
      squares.push({ column, row });
    }
  }
  return squares;
}

/** True if the square is one of the 12 lake squares (impassable terrain). */
export function isLake(square: Square): boolean {
  return LAKE_ROWS.has(square.row) && LAKE_COLUMNS.has(square.column);
}

/**
 * Classifies a square into its board region: a home zone for one side, the
 * neutral buffer (rows 5 and 8, plus the non-lake "O" squares on the lake
 * rows), or a lake.
 */
export function regionOf(square: Square): Region {
  if (isLake(square)) {
    return "lake";
  }
  if (WHITE_HOME_ROWS.has(square.row)) {
    return "white-home";
  }
  if (BLACK_HOME_ROWS.has(square.row)) {
    return "black-home";
  }
  return "buffer";
}

/** True if the square is one of the given side's own home squares. */
export function isHomeSquareFor(square: Square, side: Side): boolean {
  return regionOf(square) === (side === "white" ? "white-home" : "black-home");
}

/** The 48 home squares belonging to the given side. */
export function homeSquares(side: Side): Square[] {
  return allSquares().filter((square) => isHomeSquareFor(square, side));
}

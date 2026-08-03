// Board geometry & terrain for ruleset major 2 (editions `2-0:BATTLE` /
// `2-0:SKIRMISH`), parametric over a `BoardLayout` (see `boardLayout.ts`).
//
// Coordinate frame per rules.md §2.1/§4.4 (companion capture-the-flag
// repository, the single source of truth): columns lettered from "A"
// left-to-right (up to 26), rows numbered from 1, where row 1 is White's
// back rank and the highest row is Black's back rank. This module no longer
// fixes the grid to 12x12 - every geometry function is a function of a
// `BoardLayout` (`boardLayout.ts`, story 00000023's Step 2), describing
// dimensions, the lake pattern, and each side's home-zone depth.
//
// Every geometry function defaults its `layout` parameter to
// `BATTLE_LAYOUT` (the existing 12x12 Battle geometry, unchanged from major
// 1), and `COLUMNS`/`ROWS` remain exported as the Battle-default column/row
// lists. This lets the frozen `src/engine/` and `src/encoding/eng-nn-1/`
// modules - which are Battle/12x12-only and are not reworked by this story -
// keep calling `allSquares()`, `isLake(square)`, `homeSquares(side)`, etc.
// exactly as before, with no source changes there, while the live rule
// engine (`movement.ts`, `combat.ts`, `outcome.ts`, `placement.ts`,
// `gameState.ts`) threads an explicit `BoardLayout` - Battle's or
// Skirmish's - through the same functions.
//
// This module is pure geometry - it has no knowledge of pieces or placement
// - and depends only on `boardLayout.ts`'s data.

import {
  BOARD_LAYOUTS,
  columnLetter,
  lakeCells,
  type BoardLayout,
} from "./boardLayout.ts";

/** A column letter, "A" through (in principle) "Z" - up to 26 columns, per rules.md §2.1. */
export type Column = string;

/** A row number, numbered from 1. */
export type Row = number;

/** The board geometry the live app plays today: Battle, 12x12, unchanged from major 1. */
export const BATTLE_LAYOUT: BoardLayout = BOARD_LAYOUTS.standard_144;

/** The column letters of `layout`, left to right ("A" first). */
export function columnsOf(layout: BoardLayout): Column[] {
  return Array.from({ length: layout.columnCount }, (_, index) =>
    columnLetter(index),
  );
}

/** The row numbers of `layout`, numbered from 1. */
export function rowsOf(layout: BoardLayout): Row[] {
  return Array.from({ length: layout.rowCount }, (_, index) => index + 1);
}

/** Battle's column letters, A-L - the Battle-default constant surface (see module comment). */
export const COLUMNS: readonly Column[] = columnsOf(BATTLE_LAYOUT);

/** Battle's row numbers, 1-12 - the Battle-default constant surface (see module comment). */
export const ROWS: readonly Row[] = rowsOf(BATTLE_LAYOUT);

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

/** The 0-based index of `column` within its board's column list ("A" = 0), for adjacency arithmetic. */
export function columnIndexOf(column: Column): number {
  return column.charCodeAt(0) - "A".charCodeAt(0);
}

/** A stable string key for a square, e.g. "A1". Useful as a Map/object key. */
export function squareKey(square: Square): string {
  return `${square.column}${square.row}`;
}

/** Per-layout cache of lake-square keys, so repeated `isLake` calls don't re-derive the pattern. */
const lakeKeysByLayout = new WeakMap<BoardLayout, ReadonlySet<string>>();

function lakeKeys(layout: BoardLayout): ReadonlySet<string> {
  const cached = lakeKeysByLayout.get(layout);
  if (cached !== undefined) {
    return cached;
  }
  const keys = new Set(
    lakeCells(layout).map(
      (cell) => `${columnLetter(cell.columnIndex)}${cell.row}`,
    ),
  );
  lakeKeysByLayout.set(layout, keys);
  return keys;
}

/** All of `layout`'s squares, in no particular guaranteed order. Defaults to Battle. */
export function allSquares(layout: BoardLayout = BATTLE_LAYOUT): Square[] {
  const squares: Square[] = [];
  for (const row of rowsOf(layout)) {
    for (const column of columnsOf(layout)) {
      squares.push({ column, row });
    }
  }
  return squares;
}

/** True if `square` is one of `layout`'s lake squares (impassable terrain). Defaults to Battle. */
export function isLake(
  square: Square,
  layout: BoardLayout = BATTLE_LAYOUT,
): boolean {
  return lakeKeys(layout).has(squareKey(square));
}

/**
 * Classifies `square` into its board region on `layout`: a home zone for one
 * side, the neutral buffer (present only when `layout.hasBuffer`), or a
 * lake. Defaults to Battle.
 */
export function regionOf(
  square: Square,
  layout: BoardLayout = BATTLE_LAYOUT,
): Region {
  if (isLake(square, layout)) {
    return "lake";
  }
  if (square.row <= layout.homeRowsPerSide) {
    return "white-home";
  }
  if (square.row > layout.rowCount - layout.homeRowsPerSide) {
    return "black-home";
  }
  return "buffer";
}

/** True if `square` is one of the given side's own home squares on `layout`. Defaults to Battle. */
export function isHomeSquareFor(
  square: Square,
  side: Side,
  layout: BoardLayout = BATTLE_LAYOUT,
): boolean {
  return (
    regionOf(square, layout) ===
    (side === "white" ? "white-home" : "black-home")
  );
}

/** The home squares belonging to the given side on `layout`. Defaults to Battle (48 squares). */
export function homeSquares(
  side: Side,
  layout: BoardLayout = BATTLE_LAYOUT,
): Square[] {
  return allSquares(layout).filter((square) =>
    isHomeSquareFor(square, side, layout),
  );
}

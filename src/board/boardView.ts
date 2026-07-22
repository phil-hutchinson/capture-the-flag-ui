// Screen-orientation geometry for the board renderer (story 00000001, Step 7;
// extended for Phase 2 by story 00000004, Step 4).
//
// This module has no React dependency: it is a pure mapping from the domain
// board model (src/rules/primary/v1/board.ts) onto what a single player
// sees on screen. It knows nothing about pieces, placement, or movement.
//
// Per story 00000001's Gate A, the active player sees their own 4 home rows
// at the bottom of the screen; above them, the neutral buffer row and the
// full nearest lake row are shown as a greyed, non-interactive reminder that
// the lakes are there. The opponent's home zone (and the far lake row) is
// never rendered. `visibleRows`/`visibleColumns` provide this cropped
// placement view; `fullBoardRows` provides the uncropped Phase 2 view (all
// 12 rows, paired with `visibleColumns` for the full 144-square board).
//
// Orientation: White is un-rotated, i.e. its screen view is the absolute
// frame from rules.md §4.4 (column A at the left, row 12 "up"/away, row 1
// "down"/near). Black's view is a 180 degree rotation of that frame, which
// reverses both axes: rows run the other way (so Black's own back rank, row
// 12, ends up nearest Black on screen) and columns run right-to-left.

import {
  COLUMNS,
  ROWS,
  type Column,
  type Row,
  type Side,
  type Square,
} from "../rules/primary/v1/board.ts";

/** A visible row's role in the cropped, active-player view. */
export type RowBand = "home" | "buffer" | "lake-row";

export interface VisibleRow {
  readonly row: Row;
  readonly band: RowBand;
}

/**
 * The rows shown for the given side, in top-to-bottom screen order: the full
 * nearest lake row, the neutral buffer row, then the four home rows ending
 * with the side's own back rank at the very bottom (nearest the player). The
 * opponent's home zone and the far lake row are never included.
 */
export function visibleRows(side: Side): readonly VisibleRow[] {
  return side === "white"
    ? [
        { row: 6, band: "lake-row" },
        { row: 5, band: "buffer" },
        { row: 4, band: "home" },
        { row: 3, band: "home" },
        { row: 2, band: "home" },
        { row: 1, band: "home" },
      ]
    : [
        { row: 7, band: "lake-row" },
        { row: 8, band: "buffer" },
        { row: 9, band: "home" },
        { row: 10, band: "home" },
        { row: 11, band: "home" },
        { row: 12, band: "home" },
      ];
}

/**
 * The columns, left-to-right on screen, for the given side. White is
 * un-rotated (A...L, the absolute frame's own order); Black's 180 degree
 * rotation reverses column order too (L...A).
 */
export function visibleColumns(side: Side): readonly Column[] {
  return side === "white" ? COLUMNS : [...COLUMNS].reverse();
}

/**
 * The full 12x12 board's rows, in top-to-bottom screen order, for the given
 * side (story 00000004, Step 4). Unlike `visibleRows`, this is Phase 2's
 * uncropped view: every row is included, oriented so the side's own back
 * rank is nearest them (at the bottom of the screen). White is un-rotated
 * (row 12 at the top, row 1 at the bottom); Black is the same 180 degree
 * rotation used by `visibleColumns` (row 1 at the top, row 12 at the
 * bottom).
 */
export function fullBoardRows(side: Side): readonly Row[] {
  return side === "white" ? [...ROWS].reverse() : ROWS;
}

/** A square's zero-based screen row/column indices in the full-board view. */
export interface FullBoardDisplayPosition {
  readonly row: number;
  readonly column: number;
}

/**
 * Where `square` lands on screen for `side`'s full-board view (story
 * 00000019, Step 9's move-slide overlay): the zero-based index into
 * `fullBoardRows(side)`/`visibleColumns(side)`, i.e. the same square is a
 * different cell index for a red vs. a blue human, so this always goes
 * through those two functions rather than assuming an absolute coordinate.
 * `square` is always one of the 144 on-board squares, so both indices are
 * always found (never -1).
 */
export function fullBoardDisplayPosition(
  side: Side,
  square: Square,
): FullBoardDisplayPosition {
  return {
    row: fullBoardRows(side).indexOf(square.row),
    column: visibleColumns(side).indexOf(square.column),
  };
}

/**
 * The squares a move's path touches - its source, its destination, and, for
 * a two-square move, the single square passed over between them (story
 * 00000019, Step 9's move-slide highlight). Domain-frame, not display-frame:
 * unlike `fullBoardDisplayPosition` above, this is the same regardless of
 * which side is viewing the board, since it only ever looks at `from` and
 * `to` themselves.
 *
 * Every legal ply is one or two squares orthogonally (`movement.ts`), so
 * `from` and `to` always differ along exactly one axis (row, or column via
 * `COLUMNS`' index), by 1 or 2 squares. For a two-square move, the in-between
 * square is simply the square whose row and column index are each the
 * average of `from`'s and `to`'s; for a one-square move there is nothing
 * between them, so only `from` and `to` are returned.
 */
export function movePathSquares(from: Square, to: Square): readonly Square[] {
  const fromColumnIndex = COLUMNS.indexOf(from.column);
  const toColumnIndex = COLUMNS.indexOf(to.column);
  const rowsApart = Math.abs(to.row - from.row);
  const columnsApart = Math.abs(toColumnIndex - fromColumnIndex);

  if (rowsApart < 2 && columnsApart < 2) {
    return [from, to];
  }

  const between: Square = {
    row: ((from.row + to.row) / 2) as Row,
    column: COLUMNS[(fromColumnIndex + toColumnIndex) / 2],
  };
  return [from, between, to];
}

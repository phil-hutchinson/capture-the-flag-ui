// Full-board screen-orientation geometry, re-expressed over a `BoardGeometry`
// (story 00000036, Step 11). Lifted out of `boardView.ts`, which now holds
// only the cropped Phase-1 placement view (`visibleRows`) - major-2-only,
// since Phase 1 (placement) doesn't exist at major 3 at all.
//
// This module has no React dependency and, like its sibling `viewModel.ts`,
// **imports nothing from `src/rules/`**: it is a pure mapping from a
// `BoardGeometry`/`ViewSquare` onto what a single player sees on screen,
// major-agnostic by construction.
//
// `fullBoardColumns` here is a deliberate near-duplicate of `boardView.ts`'s
// own `visibleColumns(side, layout)`, not a replacement for it - and is
// named differently from that sibling (a peer-review fix) precisely because
// same-name/different-signature functions living in one folder are an easy
// import mistake: `boardView.ts`'s copy keeps serving `Board.tsx`'s cropped
// placement view (major-2-only, untouched by this story), while this one
// serves the full board both majors render through. Restating four lines of
// column arithmetic here is exactly the "cheaper to restate than to hoist"
// structural coincidence the plan's Decision 1 calls out for `Side`/`Square`
// - the same reasoning applies to this small a helper.
//
// Orientation: White is un-rotated (column A at the left, the highest row
// "up"/away, row 1 "down"/near, per rules.md §4.4's absolute frame). Black's
// view is a 180 degree rotation: rows run the other way (Black's own back
// rank ends up nearest Black on screen) and columns run right-to-left.

import type { BoardGeometry, ViewSide, ViewSquare } from "./viewModel.ts";

/** The letter for a 0-based column index ("A" = 0). */
function columnLetter(index: number): string {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

/** The 0-based index of `column` ("A" = 0), for adjacency arithmetic. */
function columnIndexOf(column: string): number {
  return column.charCodeAt(0) - "A".charCodeAt(0);
}

function columnsOf(geometry: BoardGeometry): readonly string[] {
  return Array.from({ length: geometry.columnCount }, (_, index) =>
    columnLetter(index),
  );
}

function rowsOf(geometry: BoardGeometry): readonly number[] {
  return Array.from({ length: geometry.rowCount }, (_, index) => index + 1);
}

/**
 * `geometry`'s rows, in top-to-bottom screen order, for the given side:
 * every row is included, oriented so the side's own back rank is nearest
 * them (at the bottom of the screen). White is un-rotated (the highest row
 * at the top, row 1 at the bottom); Black is the 180 degree rotation (row 1
 * at the top, the highest row at the bottom).
 */
export function fullBoardRows(
  side: ViewSide,
  geometry: BoardGeometry,
): readonly number[] {
  const rows = rowsOf(geometry);
  return side === "white" ? [...rows].reverse() : rows;
}

/**
 * `geometry`'s columns, left-to-right on screen, for the given side. White
 * is un-rotated ("A" first); Black's 180 degree rotation reverses column
 * order too.
 */
export function fullBoardColumns(
  side: ViewSide,
  geometry: BoardGeometry,
): readonly string[] {
  const columns = columnsOf(geometry);
  return side === "white" ? columns : [...columns].reverse();
}

/** A square's zero-based screen row/column indices in the full-board view. */
export interface FullBoardDisplayPosition {
  readonly row: number;
  readonly column: number;
}

/**
 * Where `square` lands on screen for `side`'s full-board view of `geometry`
 * (story 00000019, Step 9's move-slide overlay): the zero-based index into
 * `fullBoardRows(side, geometry)`/`fullBoardColumns(side, geometry)`, i.e.
 * the same square is a different cell index for a red vs. a blue human, so
 * this always goes through those two functions rather than assuming an
 * absolute coordinate. `square` is always one of `geometry`'s on-board
 * squares, so both indices are always found (never -1).
 */
export function fullBoardDisplayPosition(
  side: ViewSide,
  square: ViewSquare,
  geometry: BoardGeometry,
): FullBoardDisplayPosition {
  return {
    row: fullBoardRows(side, geometry).indexOf(square.row),
    column: fullBoardColumns(side, geometry).indexOf(square.column),
  };
}

/**
 * The squares a move's path touches - its source, its destination, and, for
 * a two-square move, the single square passed over between them (story
 * 00000019, Step 9's move-slide highlight). Domain-frame, not display-frame:
 * unlike `fullBoardDisplayPosition` above, this is the same regardless of
 * which side is viewing the board, since it only ever looks at `from` and
 * `to` themselves. Board-size independent - column arithmetic goes through
 * `columnIndexOf`/`columnLetter` (letter offsets from "A"), not any fixed
 * column list, so no `geometry` argument is needed here.
 *
 * Every legal ply in every major is one or two squares orthogonally, or one
 * square diagonally, so `from` and `to` never differ by more than 2 squares
 * on either axis. For a two-square orthogonal move, the in-between square is
 * simply the square whose row and column index are each the average of
 * `from`'s and `to`'s; for a one-square move (orthogonal or diagonal) there
 * is nothing between them, so only `from` and `to` are returned.
 */
export function movePathSquares(
  from: ViewSquare,
  to: ViewSquare,
): readonly ViewSquare[] {
  const fromColumnIndex = columnIndexOf(from.column);
  const toColumnIndex = columnIndexOf(to.column);
  const rowsApart = Math.abs(to.row - from.row);
  const columnsApart = Math.abs(toColumnIndex - fromColumnIndex);

  if (rowsApart < 2 && columnsApart < 2) {
    return [from, to];
  }

  const between: ViewSquare = {
    row: (from.row + to.row) / 2,
    column: columnLetter((fromColumnIndex + toColumnIndex) / 2),
  };
  return [from, between, to];
}

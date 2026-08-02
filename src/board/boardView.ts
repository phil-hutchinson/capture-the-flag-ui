// Screen-orientation geometry for the board renderer (story 00000001, Step 7;
// extended for Phase 2 by story 00000004, Step 4; made parametric over a
// `BoardLayout` by story 00000023, Step 6).
//
// This module has no React dependency: it is a pure mapping from the domain
// board model (src/rules/primary/v2/board.ts) onto what a single player
// sees on screen. It knows nothing about pieces, placement, or movement.
//
// Every function here takes an optional trailing `layout: BoardLayout`,
// defaulting to `BATTLE_LAYOUT` (the existing 12x12 Battle geometry) so every
// pre-existing call site keeps working unchanged, mirroring the pattern
// `board.ts`'s own geometry functions established in Step 3. Skirmish
// (`standard_64`, 8x8, no neutral buffer row) is just a different `layout`
// argument, not a separate code path.
//
// Per story 00000001's Gate A, the active player sees their own home rows at
// the bottom of the screen; above them (when `layout.hasBuffer`), the neutral
// buffer row and the full nearest lake row are shown as a greyed,
// non-interactive reminder that the lakes are there. On a no-buffer layout
// (Skirmish) the home rows sit directly against the shown lake row - there is
// no buffer band to draw. The opponent's home zone (and the far lake row) is
// never rendered. `visibleRows`/`visibleColumns` provide this cropped
// placement view; `fullBoardRows` provides the uncropped Phase 2 view (every
// row of `layout`, paired with `visibleColumns` for the full board).
//
// Orientation: White is un-rotated, i.e. its screen view is the absolute
// frame from rules.md §4.4 (column A at the left, the highest row "up"/away,
// row 1 "down"/near). Black's view is a 180 degree rotation of that frame,
// which reverses both axes: rows run the other way (so Black's own back
// rank ends up nearest Black on screen) and columns run right-to-left.

import {
  BATTLE_LAYOUT,
  columnIndexOf,
  columnsOf,
  rowsOf,
  type Column,
  type Row,
  type Side,
  type Square,
} from "../rules/primary/v2/board.ts";
import {
  columnLetter,
  type BoardLayout,
} from "../rules/primary/v2/boardLayout.ts";

/** A visible row's role in the cropped, active-player view. */
export type RowBand = "home" | "buffer" | "lake-row";

export interface VisibleRow {
  readonly row: Row;
  readonly band: RowBand;
}

/**
 * The rows shown for the given side on `layout` (defaults to Battle), in
 * top-to-bottom screen order: the full nearest lake row, the neutral buffer
 * row (only when `layout.hasBuffer` - omitted entirely for Skirmish's
 * no-buffer layout), then `layout.homeRowsPerSide` home rows ending with the
 * side's own back rank at the very bottom (nearest the player). The
 * opponent's home zone and the far lake row are never included.
 */
export function visibleRows(
  side: Side,
  layout: BoardLayout = BATTLE_LAYOUT,
): readonly VisibleRow[] {
  const nearLakeRow =
    side === "white"
      ? Math.min(...layout.lakeRows)
      : Math.max(...layout.lakeRows);

  const rows: VisibleRow[] = [{ row: nearLakeRow, band: "lake-row" }];

  if (layout.hasBuffer) {
    const bufferRow = side === "white" ? nearLakeRow - 1 : nearLakeRow + 1;
    rows.push({ row: bufferRow, band: "buffer" });
  }

  const homeRows =
    side === "white"
      ? Array.from(
          { length: layout.homeRowsPerSide },
          (_, index) => layout.homeRowsPerSide - index,
        )
      : Array.from(
          { length: layout.homeRowsPerSide },
          (_, index) => layout.rowCount - layout.homeRowsPerSide + 1 + index,
        );
  for (const row of homeRows) {
    rows.push({ row, band: "home" });
  }

  return rows;
}

/**
 * The columns, left-to-right on screen, for the given side on `layout`
 * (defaults to Battle). White is un-rotated (`layout`'s own column order,
 * "A" first); Black's 180 degree rotation reverses column order too.
 */
export function visibleColumns(
  side: Side,
  layout: BoardLayout = BATTLE_LAYOUT,
): readonly Column[] {
  const columns = columnsOf(layout);
  return side === "white" ? columns : [...columns].reverse();
}

/**
 * `layout`'s rows (defaults to Battle), in top-to-bottom screen order, for
 * the given side (story 00000004, Step 4; parametric since story 00000023,
 * Step 6). Unlike `visibleRows`, this is Phase 2's uncropped view: every row
 * of `layout` is included, oriented so the side's own back rank is nearest
 * them (at the bottom of the screen). White is un-rotated (the highest row
 * at the top, row 1 at the bottom); Black is the same 180 degree rotation
 * used by `visibleColumns` (row 1 at the top, the highest row at the
 * bottom).
 */
export function fullBoardRows(
  side: Side,
  layout: BoardLayout = BATTLE_LAYOUT,
): readonly Row[] {
  const rows = rowsOf(layout);
  return side === "white" ? [...rows].reverse() : rows;
}

/** A square's zero-based screen row/column indices in the full-board view. */
export interface FullBoardDisplayPosition {
  readonly row: number;
  readonly column: number;
}

/**
 * Where `square` lands on screen for `side`'s full-board view of `layout`
 * (defaults to Battle) (story 00000019, Step 9's move-slide overlay): the
 * zero-based index into `fullBoardRows(side, layout)`/
 * `visibleColumns(side, layout)`, i.e. the same square is a different cell
 * index for a red vs. a blue human, so this always goes through those two
 * functions rather than assuming an absolute coordinate. `square` is always
 * one of `layout`'s on-board squares, so both indices are always found
 * (never -1).
 */
export function fullBoardDisplayPosition(
  side: Side,
  square: Square,
  layout: BoardLayout = BATTLE_LAYOUT,
): FullBoardDisplayPosition {
  return {
    row: fullBoardRows(side, layout).indexOf(square.row),
    column: visibleColumns(side, layout).indexOf(square.column),
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
 * column list, so no `layout` argument is needed here.
 *
 * Every legal ply is one or two squares orthogonally, or one square
 * diagonally (`movement.ts`), so `from` and `to` never differ by more than 2
 * squares on either axis. For a two-square orthogonal move, the in-between
 * square is simply the square whose row and column index are each the
 * average of `from`'s and `to`'s; for a one-square move (orthogonal or
 * diagonal) there is nothing between them, so only `from` and `to` are
 * returned.
 */
export function movePathSquares(from: Square, to: Square): readonly Square[] {
  const fromColumnIndex = columnIndexOf(from.column);
  const toColumnIndex = columnIndexOf(to.column);
  const rowsApart = Math.abs(to.row - from.row);
  const columnsApart = Math.abs(toColumnIndex - fromColumnIndex);

  if (rowsApart < 2 && columnsApart < 2) {
    return [from, to];
  }

  const between: Square = {
    row: (from.row + to.row) / 2,
    column: columnLetter((fromColumnIndex + toColumnIndex) / 2),
  };
  return [from, between, to];
}

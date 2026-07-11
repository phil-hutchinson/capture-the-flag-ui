// Screen-orientation geometry for the board renderer (story 00000001, Step 7).
//
// This module has no React dependency: it is a pure mapping from the domain
// board model (src/rules/primary/v1_1/board.ts) onto what a single player
// sees on screen. It knows nothing about pieces or placement.
//
// Per the story's Gate A, the active player sees their own 4 home rows at
// the bottom of the screen; above them, the neutral buffer row and the full
// nearest lake row are shown as a greyed, non-interactive reminder that the
// lakes are there. The opponent's home zone (and the far lake row) is never
// rendered.
//
// Orientation: White is un-rotated, i.e. its screen view is the absolute
// frame from rules.md §4.4 (column A at the left, row 12 "up"/away, row 1
// "down"/near). Black's view is a 180 degree rotation of that frame, which
// reverses both axes: rows run the other way (so Black's own back rank, row
// 12, ends up nearest Black on screen) and columns run right-to-left.

import {
  COLUMNS,
  type Column,
  type Row,
  type Side,
} from "../rules/primary/v1_1/board.ts";

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

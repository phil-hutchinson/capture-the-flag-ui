// Screen-orientation geometry for the Phase-1 placement board (story
// 00000001, Step 7; extended for Phase 2 by story 00000004, Step 4; made
// parametric over a `BoardLayout` by story 00000023, Step 6).
//
// Story 00000036, Step 11: the Phase-2 full-board orientation helpers that
// used to live here (`fullBoardRows`, `fullBoardDisplayPosition`,
// `movePathSquares`) moved to `src/board/view/boardOrientation.ts`,
// re-expressed over the major-agnostic `BoardGeometry` - `FullBoard.tsx` now
// serves both ruleset majors, so it can no longer take a major-2
// `BoardLayout` directly. This module keeps only what remains genuinely
// major-2-only: the *cropped* Phase-1 placement view (`visibleRows`), which
// has no major-3 counterpart at all (major 3 has no placement phase).
// `visibleColumns` stays here too, unchanged, because `Board.tsx`'s cropped
// placement view still needs it; `view/boardOrientation.ts` restates its own
// copy for the full board rather than sharing this one, the same "cheaper to
// restate than to hoist" reasoning the plan's Decision 1 applies to
// `Side`/`Square`.
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
// never rendered.
//
// Orientation: White is un-rotated, i.e. its screen view is the absolute
// frame from rules.md §4.4 (column A at the left, the highest row "up"/away,
// row 1 "down"/near). Black's view is a 180 degree rotation of that frame,
// which reverses both axes: rows run the other way (so Black's own back
// rank ends up nearest Black on screen) and columns run right-to-left.

import {
  BATTLE_LAYOUT,
  columnsOf,
  type Column,
  type Row,
  type Side,
} from "../rules/primary/v2/board.ts";
import type { BoardLayout } from "../rules/primary/v2/boardLayout.ts";

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

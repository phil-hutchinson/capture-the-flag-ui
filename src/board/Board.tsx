// Board renderer, from the active player's own perspective (story 00000001,
// Step 7 geometry/terrain; Step 8 adds placed-piece rendering and
// click-to-place; Step 9 adds the `selectedSquare` highlight used while
// interacting with an already-placed piece). Draws the active player's home
// rows plus a greyed, non-interactive reminder of the buffer row (Battle
// only) and the full nearest lake row.
//
// Story 00000002, Step 3: ported onto the shared accessible grid
// (`grid/AccessibleGrid.tsx`), following `FullBoard.tsx`'s established
// pattern, so the board is keyboard-operable and screen-reader-perceivable.
// `visibleRows`/`visibleColumns` are already rectangular, so every visible
// cell - home, buffer, and lake-row alike - becomes a grid cell; only
// `band === "home"` cells are `actionable` (Decision 1 of this story's
// implementation plan), so the buffer/lake-row bands stay reachable by arrow
// key (a screen-reader user can still learn a lake is there) but do nothing
// on Enter/Space, matching the mouse's `pointer-events: none` today. Cell
// labels come from `placementAnnouncement.ts`'s `placementSquareLabel`. The
// grid's initial roving-tabindex target is the first home-band square in
// screen order (not `AccessibleGrid`'s own row-major default, which would
// otherwise land on the lake row sitting above the home band), computed from
// `visibleRows` rather than any hardcoded index, since the home band starts
// at a different row on Battle vs. Skirmish. `onSquareActivate` (renamed from
// `onSquareClick`, since activation is now also Enter/Space) is called only
// for `actionable` cells, exactly matching today's click-only behaviour for
// mouse and touch users.
//
// Peer review finding #3: the grid carries `key={activeSide}` (below), so it
// fully remounts - and re-seeds `initialFocus` via `AccessibleGrid`'s lazy
// `useState` initializer - whenever the active player changes. Without it,
// `Board` is never unmounted between the two players' placements, so the
// second player's first Tab would land wherever the first player last left
// the roving-tabindex target (possibly a lake or buffer cell), rather than on
// their own first home square.
//
// Peer review finding #8: `data-active-side` (the wrapper `<div>` below)
// moved here from the grid element itself as a side effect of this story's
// port onto `AccessibleGrid` (`AccessibleGrid` owns its own `role="grid"`
// element and takes no arbitrary `data-*` passthrough) - nothing selects on
// it today, but a later reader should read the relocation as intentional.
//
// Story 00000025, Step 5: `closedToTowerSquares` draws a quiet modifier class
// on whichever of those squares the caller names - `HotSeatGame.tsx` passes
// `squaresClosedToTowers(placement)` only while a Tower is in hand (Decisions
// item 3), and nothing otherwise; `EngineGame.tsx` passes nothing at all
// (Battle-only, so the set is always empty anyway). The marking is a plain
// CSS background (`board-square--closed-to-towers`, Board.css) - unlike the
// lake icon it adds no new element to the accessibility tree; since story
// 00000002 it is also named in the closed square's own accessible label
// (`placementSquareLabel`), on top of the existing "Towers can't go on … "
// hint in `PlacementStatus`'s live region.

import type { CSSProperties } from "react";
import { PieceIcon, LAKE_SYMBOL_ID } from "../art/PieceIcon.tsx";
import {
  isLake,
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v2/board.ts";
import type { BoardLayout } from "../rules/primary/v2/boardLayout.ts";
import { pieceAt, type PlacementState } from "../rules/primary/v2/placement.ts";
import type { PieceTypeId } from "../rules/primary/v2/pieces.ts";
import { visibleColumns, visibleRows, type RowBand } from "./boardView.ts";
import {
  AccessibleGrid,
  type GridCellDescriptor,
} from "./grid/AccessibleGrid.tsx";
import type { GridPosition } from "./grid/gridNavigation.ts";
import { placementSquareLabel } from "./placementAnnouncement.ts";
import { sideColorName } from "./sideNames.ts";
import "./Board.css";

export interface BoardProps {
  /** The player whose perspective the board is drawn from. */
  readonly activeSide: Side;
  /**
   * The active player's in-progress placement, if any. When provided, placed
   * pieces are drawn on their squares. Omit to render bare geometry only.
   */
  readonly placement?: PlacementState;
  /**
   * The board layout to render (story 00000023, Step 6; required since the
   * peer review's finding #2 - an omitted layout used to default silently to
   * Battle's, the same defect class found live at this story's Gate B/D).
   * Every caller passes its own edition's `boardLayout` explicitly -
   * typically `placement.boardLayout` when `placement` is given, or
   * `BATTLE_LAYOUT` (`board.ts`) for a caller that only ever plays Battle.
   */
  readonly layout: BoardLayout;
  /**
   * Called with the domain square of an interactive (home-band) square when
   * it is activated - a click, or Enter/Space when that square has keyboard
   * focus (story 00000002, Step 3: renamed from `onSquareClick` since the
   * board now renders through the shared accessible grid, and activation is
   * no longer only a click).
   */
  readonly onSquareActivate?: (square: Square) => void;
  /**
   * The square currently selected for interaction (Step 9's board-selection
   * track), if any. Drawn with a highlight so the player can see which
   * placed piece a click will move, swap, or return to the tray.
   */
  readonly selectedSquare?: Square;
  /**
   * Squares to draw as closed to Towers (story 00000025, Step 5) - typically
   * `squaresClosedToTowers(placement)`, passed only while a Tower is in hand.
   * Omit (or pass `[]`) to draw no marking, which is always correct on
   * Battle and whenever no Tower is in hand.
   */
  readonly closedToTowerSquares?: readonly Square[];
  /**
   * Text pushed into the board's polite live region (story 00000002, Step 3
   * adds this pass-through to `AccessibleGrid`; `HotSeatGame.tsx` becomes the
   * first caller to actually set it in Step 5).
   */
  readonly announcement?: string;
}

/**
 * Inline style carrying the grid's own size, sized to the board layout - set
 * on the wrapper around the accessible grid (story 00000002, Step 3), not on
 * the grid element itself, since `AccessibleGrid` accepts a `className` but
 * no `style`. Plain CSS custom-property inheritance carries `--columns`/
 * `--rows` down through the grid's own `display: contents` wrapper to
 * `.board`'s `grid-template-*` rules (Board.css), mirroring
 * `FullBoard.tsx`'s `.full-board__stage`.
 */
interface BoardStageStyle extends CSSProperties {
  readonly "--columns": number;
  readonly "--rows": number;
}

/** Board grid, cropped and oriented to one player's own view. */
export function Board({
  activeSide,
  placement,
  layout,
  onSquareActivate,
  selectedSquare,
  closedToTowerSquares,
  announcement,
}: BoardProps) {
  const rows = visibleRows(activeSide, layout);
  const columns = visibleColumns(activeSide, layout);
  const selectedKey = selectedSquare ? squareKey(selectedSquare) : undefined;
  const closedKeys = new Set(
    (closedToTowerSquares ?? []).map((square) => squareKey(square)),
  );

  // The first home-band square in screen order - never a hardcoded index,
  // since the home band starts at a different row on Battle (below a buffer
  // row) than on Skirmish (no buffer row at all). Falls back to the grid's
  // own default (undefined here) if, somehow, no row is home-banded.
  const homeRowIndex = rows.findIndex(({ band }) => band === "home");
  const initialFocus: GridPosition | undefined =
    homeRowIndex === -1 ? undefined : { row: homeRowIndex, column: 0 };

  const cellRows: GridCellDescriptor[][] = rows.map(({ row, band }) =>
    columns.map((column) => {
      const square: Square = { column, row };
      const key = squareKey(square);
      const lake = isLake(square, layout);
      const pieceType = placement ? pieceAt(placement, square) : undefined;
      const selected = selectedKey !== undefined && key === selectedKey;
      const closedToTowers = closedKeys.has(key);

      return {
        content: (
          <BoardSquareCell
            band={band}
            lake={lake}
            side={activeSide}
            pieceType={pieceType}
            selected={selected}
            closedToTowers={closedToTowers}
          />
        ),
        label: placementSquareLabel({
          square,
          band,
          lake,
          pieceType,
          side: activeSide,
          selected,
          closedToTowers,
        }),
        focusable: true,
        actionable: band === "home" && onSquareActivate !== undefined,
      };
    }),
  );

  const stageStyle: BoardStageStyle = {
    "--columns": columns.length,
    "--rows": rows.length,
  };

  return (
    <div
      className="board-stage"
      data-active-side={activeSide}
      style={stageStyle}
    >
      <AccessibleGrid
        key={activeSide}
        label={`${sideColorName(activeSide)}'s placement board`}
        rows={cellRows}
        className="board"
        announcement={announcement}
        initialFocus={initialFocus}
        onActivate={(position: GridPosition) =>
          onSquareActivate?.({
            column: columns[position.column],
            row: rows[position.row].row,
          })
        }
      />
    </div>
  );
}

interface BoardSquareCellProps {
  readonly band: RowBand;
  readonly lake: boolean;
  readonly side: Side;
  readonly pieceType?: PieceTypeId;
  readonly selected?: boolean;
  readonly closedToTowers?: boolean;
}

function BoardSquareCell({
  band,
  lake,
  side,
  pieceType,
  selected,
  closedToTowers,
}: BoardSquareCellProps) {
  const classNames = ["board-square", `board-square--${band}`];
  if (lake) {
    classNames.push("board-square--lake");
  }
  if (selected) {
    classNames.push("board-square--selected");
  }
  if (closedToTowers) {
    classNames.push("board-square--closed-to-towers");
  }

  return (
    <div className={classNames.join(" ")}>
      <div className="board-square__inner">
        {lake && (
          <svg
            viewBox="0 0 64 64"
            className="board-square__lake-icon"
            aria-hidden="true"
          >
            <use href={`#${LAKE_SYMBOL_ID}`} />
          </svg>
        )}
        {pieceType && (
          <PieceIcon
            type={pieceType}
            side={side}
            className="board-square__piece-icon"
          />
        )}
      </div>
    </div>
  );
}

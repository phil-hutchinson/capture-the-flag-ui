// Board renderer, from the active player's own perspective (story 00000001,
// Step 7 geometry/terrain; Step 8 adds placed-piece rendering and
// click-to-place; Step 9 adds the `selectedSquare` highlight used while
// interacting with an already-placed piece). Draws the active player's 4
// home rows plus a greyed, non-interactive reminder of the buffer row and
// the full nearest lake row. The buffer/lake-row bands are never clickable
// (see Board.css's `pointer-events: none`); only home-band squares call back
// via `onSquareClick`. This component itself is unaware of the click
// grammar (move/swap/select/place) - App.tsx owns that - it only renders
// whichever square is passed in as `selectedSquare` with a highlight.

import { PieceIcon, LAKE_SYMBOL_ID } from "../art/PieceIcon.tsx";
import {
  isLake,
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v1_1/board.ts";
import {
  pieceAt,
  type PlacementState,
} from "../rules/primary/v1_1/placement.ts";
import type { PieceTypeId } from "../rules/primary/v1_1/pieces.ts";
import { visibleColumns, visibleRows, type RowBand } from "./boardView.ts";
import "./Board.css";

export interface BoardProps {
  /** The player whose perspective the board is drawn from. */
  readonly activeSide: Side;
  /**
   * The active player's in-progress placement, if any. When provided, placed
   * pieces are drawn on their squares. Omit to render bare geometry only.
   */
  readonly placement?: PlacementState;
  /** Called when an interactive (home-band) square is clicked. */
  readonly onSquareClick?: (square: Square) => void;
  /**
   * The square currently selected for interaction (Step 9's board-selection
   * track), if any. Drawn with a highlight so the player can see which
   * placed piece a click will move, swap, or return to the tray.
   */
  readonly selectedSquare?: Square;
}

/** Board grid, cropped and oriented to one player's own view. */
export function Board({
  activeSide,
  placement,
  onSquareClick,
  selectedSquare,
}: BoardProps) {
  const rows = visibleRows(activeSide);
  const columns = visibleColumns(activeSide);
  const selectedKey = selectedSquare ? squareKey(selectedSquare) : undefined;

  return (
    <div className="board" data-active-side={activeSide}>
      {rows.map(({ row, band }) =>
        columns.map((column) => {
          const square: Square = { column, row };
          const pieceType = placement ? pieceAt(placement, square) : undefined;
          return (
            <BoardSquareCell
              key={squareKey(square)}
              square={square}
              band={band}
              side={activeSide}
              pieceType={pieceType}
              selected={
                selectedKey !== undefined && squareKey(square) === selectedKey
              }
              onClick={
                band === "home" && onSquareClick
                  ? () => onSquareClick(square)
                  : undefined
              }
            />
          );
        }),
      )}
    </div>
  );
}

interface BoardSquareCellProps {
  readonly square: Square;
  readonly band: RowBand;
  readonly side: Side;
  readonly pieceType?: PieceTypeId;
  readonly selected?: boolean;
  readonly onClick?: () => void;
}

function BoardSquareCell({
  square,
  band,
  side,
  pieceType,
  selected,
  onClick,
}: BoardSquareCellProps) {
  const lake = isLake(square);
  const classNames = ["board-square", `board-square--${band}`];
  if (lake) {
    classNames.push("board-square--lake");
  }
  if (selected) {
    classNames.push("board-square--selected");
  }

  return (
    <div className={classNames.join(" ")} onClick={onClick}>
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

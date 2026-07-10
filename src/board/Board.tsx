// Board renderer, from the active player's own perspective (story 00000001,
// Step 7). Draws board geometry and terrain only: the active player's 4 home
// rows plus a greyed, non-interactive reminder of the buffer row and the
// full nearest lake row. No pieces and no placement interaction yet
// (Steps 8-10 add the tray, click-to-place, and the other placement
// interactions on top of this).

import {
  isLake,
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v1_1/board.ts";
import { LAKE_SYMBOL_ID } from "../art/PieceIcon.tsx";
import { visibleColumns, visibleRows, type RowBand } from "./boardView.ts";
import "./Board.css";

export interface BoardProps {
  /** The player whose perspective the board is drawn from. */
  readonly activeSide: Side;
}

/** Board grid, cropped and oriented to one player's own view. */
export function Board({ activeSide }: BoardProps) {
  const rows = visibleRows(activeSide);
  const columns = visibleColumns(activeSide);

  return (
    <div className="board" data-active-side={activeSide}>
      {rows.map(({ row, band }) =>
        columns.map((column) => {
          const square: Square = { column, row };
          return (
            <BoardSquareCell
              key={squareKey(square)}
              square={square}
              band={band}
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
}

function BoardSquareCell({ square, band }: BoardSquareCellProps) {
  const lake = isLake(square);
  const classNames = ["board-square", `board-square--${band}`];
  if (lake) {
    classNames.push("board-square--lake");
  }

  return (
    <div className={classNames.join(" ")}>
      <div className="board-square__inner">
        {lake && (
          <svg
            viewBox="0 0 64 64"
            className="board-square__lake-icon"
            role="img"
            aria-hidden="true"
          >
            <use href={`#${LAKE_SYMBOL_ID}`} />
          </svg>
        )}
      </div>
    </div>
  );
}

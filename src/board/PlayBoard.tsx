// Phase 2 board renderer, oriented to whichever side is to move (story
// 00000004, Step 7). Unlike the placement `Board` (Board.tsx), this draws
// the *full* 12x12 board - both armies fully visible, per Phase 2's
// perfect-information rule - through the reusable accessible grid (Step 5),
// so movement is keyboard-operable and screen-reader-perceivable from the
// start rather than retrofitted.
//
// Orientation flips with the side to move (Step 4's `fullBoardRows`): each
// hand-off re-renders the board from the new active player's own
// perspective, their home edge nearest them. This component itself is
// unaware of the move grammar (select/deselect/move) - it only renders
// whichever squares `playSession.ts`'s `actionableSquares` currently marks
// actionable, and reports raw square activations up to the caller via
// `onActivate`; App.tsx owns turning an activation into a selection or a
// move (via `activateSquare`).

import { PieceIcon, LAKE_SYMBOL_ID } from "../art/PieceIcon.tsx";
import {
  isLake,
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v1_1/board.ts";
import type { PlacedPiece } from "../rules/primary/v1_1/gameState.ts";
import { PIECE_CATALOG } from "../rules/primary/v1_1/pieces.ts";
import {
  AccessibleGrid,
  type GridCellDescriptor,
} from "./grid/AccessibleGrid.tsx";
import type { GridPosition } from "./grid/gridNavigation.ts";
import { actionableSquares, type PlaySession } from "./playSession.ts";
import { fullBoardRows, visibleColumns } from "./boardView.ts";
import "./PlayBoard.css";

/** Player-facing color name for a side. Internal-only; never shown as "White"/"Black". */
function sideColorName(side: Side): string {
  return side === "white" ? "Red" : "Blue";
}

/** Accessible label for one square: its name plus what occupies it, if anything. */
function squareLabel(
  square: Square,
  piece: PlacedPiece | undefined,
  lake: boolean,
  selected: boolean,
): string {
  const name = squareKey(square);
  if (lake) {
    return `${name}, lake`;
  }
  if (piece === undefined) {
    return `${name}, empty`;
  }
  const occupant = `${sideColorName(piece.side)} ${
    PIECE_CATALOG[piece.pieceType].displayName
  }`;
  return selected ? `${name}, ${occupant}, selected` : `${name}, ${occupant}`;
}

export interface PlayBoardProps {
  /** The in-progress Phase-2 session: whose turn, the board, and any selection. */
  readonly session: PlaySession;
  /** Called with the domain square of an actionable cell when it is activated. */
  readonly onActivate: (square: Square) => void;
}

/**
 * The full 12x12 board, oriented to `session.play.sideToMove` (Step 4), drawn
 * through the accessible grid (Step 5). Actionable squares - the
 * side-to-move's own movable pieces with nothing selected, or the selected
 * piece's legal destinations - come straight from `playSession.ts`'s
 * `actionableSquares` (Step 6), so illegal moves are never offered.
 */
export function PlayBoard({ session, onActivate }: PlayBoardProps) {
  const side = session.play.sideToMove;
  const rows = fullBoardRows(side);
  const columns = visibleColumns(side);
  const actionableKeys = new Set(
    actionableSquares(session).map((square) => squareKey(square)),
  );
  const selectedKey = session.selection
    ? squareKey(session.selection)
    : undefined;

  const cellRows: GridCellDescriptor[][] = rows.map((row) =>
    columns.map((column) => {
      const square: Square = { column, row };
      const key = squareKey(square);
      const lake = isLake(square);
      const piece = session.play.board[key];
      const selected = key === selectedKey;
      const actionable = actionableKeys.has(key);

      return {
        content: (
          <PlayBoardCell
            piece={piece}
            lake={lake}
            selected={selected}
            actionable={actionable}
          />
        ),
        label: squareLabel(square, piece, lake, selected),
        focusable: true,
        actionable,
      };
    }),
  );

  return (
    <AccessibleGrid
      label="Battlefield"
      rows={cellRows}
      className="play-board"
      onActivate={(position: GridPosition) =>
        onActivate({
          column: columns[position.column],
          row: rows[position.row],
        })
      }
    />
  );
}

interface PlayBoardCellProps {
  readonly piece: PlacedPiece | undefined;
  readonly lake: boolean;
  readonly selected: boolean;
  readonly actionable: boolean;
}

function PlayBoardCell({
  piece,
  lake,
  selected,
  actionable,
}: PlayBoardCellProps) {
  const classNames = ["play-board__square"];
  if (lake) {
    classNames.push("play-board__square--lake");
  }
  if (selected) {
    classNames.push("play-board__square--selected");
  } else if (actionable) {
    classNames.push("play-board__square--actionable");
  }

  return (
    <div className={classNames.join(" ")}>
      <div className="play-board__square-inner">
        {lake && (
          <svg
            viewBox="0 0 64 64"
            className="play-board__lake-icon"
            aria-hidden="true"
          >
            <use href={`#${LAKE_SYMBOL_ID}`} />
          </svg>
        )}
        {piece && (
          <PieceIcon
            type={piece.pieceType}
            side={piece.side}
            className="play-board__piece-icon"
          />
        )}
      </div>
    </div>
  );
}

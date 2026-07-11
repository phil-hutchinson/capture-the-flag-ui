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
// whichever squares are highlighted and which respond to activation, and
// reports raw square activations up to the caller via `onActivate`; App.tsx
// owns turning an activation into a selection, a deselect, a switch, or a
// move (via `activateSquare`).
//
// Visual highlighting is deliberately minimal (Gate D revision): the only
// square-fill highlights are for an *in-progress selection* - the picked-up
// piece (`--selected`, dark ink) and its legal destinations (`--destination`,
// an amber tint, background only, no border). With nothing selected, no
// square is highlighted at all: which of your own pieces can move is left
// self-evident, and the amber *border* is reserved exclusively for the
// keyboard-focus ring (AccessibleGrid.css's `:focus-visible`), so a fill and
// a border never read as the same thing.
//
// That visual set is strictly smaller than the set of squares that actually
// *respond* to activation. The accessible grid's activation gate
// (`GridCellDescriptor.actionable`, which decides which cells answer a click
// or Enter/Space) is driven by `activatableSquares` from `playSession.ts` -
// every own movable piece plus, while one is selected, its legal
// destinations - so picking up a piece, deselecting it, and switching to a
// different own piece are all reachable by mouse and keyboard even though an
// unselected movable piece shows no highlight.

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
import {
  actionableSquares,
  activatableSquares,
  type PlaySession,
} from "./playSession.ts";
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
  /**
   * Text pushed into the board's polite live region (Gate D) - what a piece
   * was selected with how many moves it has, what just moved and where, and
   * whose turn it now is. The caller (`App.tsx`) derives this from session
   * transitions via `playAnnouncement.ts`'s `describeActivation`.
   */
  readonly announcement?: string;
}

/**
 * The full 12x12 board, oriented to `session.play.sideToMove` (Step 4), drawn
 * through the accessible grid (Step 5). The only highlighted squares are for
 * an in-progress selection: the selected piece and its legal destinations
 * (from `actionableSquares` once a piece is selected); with nothing selected
 * no square is highlighted. Which squares actually respond to activation come
 * from the larger `activatableSquares` (Step 9), so illegal moves are never
 * offered while selecting, deselecting, and switching selection remain
 * reachable.
 */
export function PlayBoard({
  session,
  onActivate,
  announcement,
}: PlayBoardProps) {
  const side = session.play.sideToMove;
  const rows = fullBoardRows(side);
  const columns = visibleColumns(side);
  // Only a selected piece's legal destinations are highlighted; with nothing
  // selected `actionableSquares` returns own movable pieces, which we
  // deliberately leave unhighlighted (see the module comment).
  const highlightedKeys = new Set(
    session.selection
      ? actionableSquares(session).map((square) => squareKey(square))
      : [],
  );
  const activatableKeys = new Set(
    activatableSquares(session).map((square) => squareKey(square)),
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
      const isDestination = highlightedKeys.has(key);
      const activatable = activatableKeys.has(key);

      return {
        content: (
          <PlayBoardCell
            piece={piece}
            lake={lake}
            selected={selected}
            destination={isDestination}
          />
        ),
        label: squareLabel(square, piece, lake, selected),
        focusable: true,
        actionable: activatable,
      };
    }),
  );

  return (
    <AccessibleGrid
      label="Battlefield"
      rows={cellRows}
      className="play-board"
      announcement={announcement}
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
  /** A legal destination for the currently selected piece (amber fill, no border). */
  readonly destination: boolean;
}

function PlayBoardCell({
  piece,
  lake,
  selected,
  destination,
}: PlayBoardCellProps) {
  const classNames = ["play-board__square"];
  if (lake) {
    classNames.push("play-board__square--lake");
  }
  if (selected) {
    classNames.push("play-board__square--selected");
  } else if (destination) {
    classNames.push("play-board__square--destination");
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

// Phase 2 board renderer, oriented to whichever side is to move (story
// 00000004, Step 7). Unlike the placement `Board` (Board.tsx), this draws
// the *full* 12x12 board - both armies fully visible, per Phase 2's
// perfect-information rule - through the reusable accessible grid (Step 5),
// so movement is keyboard-operable and screen-reader-perceivable from the
// start rather than retrofitted.
//
// Orientation follows `playSession.ts`'s `viewSide` (Step 4's
// `fullBoardRows`): each hand-off re-renders the board from the perspective
// of the player now sitting at it, their home edge nearest them. That is
// normally the side to move, the exception being a pending draw offer, which
// hands the board to the opponent to answer without changing whose turn it
// is (story 00000006, Step 13). This component itself is
// unaware of the move grammar (select/deselect/move) - it only renders
// whichever squares are highlighted and which respond to activation, and
// reports raw square activations up to the caller via `onActivate`; App.tsx
// owns turning an activation into a selection, a deselect, a switch, or a
// move (via `activateSquare`).
//
// Visual highlighting is deliberately minimal (Gate D revision): the only
// square-fill highlights are for an *in-progress selection* - the picked-up
// piece (`--selected`, dark ink), its legal plain-move destinations
// (`--destination`, an amber tint, background only, no border), and (story
// 00000005, Step 7) its legal *attack* targets (`--attack`, its own distinct
// fill/border treatment) - always an enemy-occupied square, so a sighted
// player can tell an attack apart from a plain move before committing. With
// nothing selected, no square is highlighted at all: which of your own
// pieces can move is left self-evident, and the amber *border* is reserved
// exclusively for the keyboard-focus ring (AccessibleGrid.css's
// `:focus-visible`), so a fill and a border never read as the same thing,
// and `--attack` in turn never reads as a `--destination` or a focus ring.
//
// That visual set is strictly smaller than the set of squares that actually
// *respond* to activation. The accessible grid's activation gate
// (`GridCellDescriptor.actionable`, which decides which cells answer a click
// or Enter/Space) is driven by `activatableSquares` from `playSession.ts` -
// every own movable piece plus, while one is selected, its legal
// destinations and legal attack targets - so picking up a piece, deselecting
// it, and switching to a different own piece are all reachable by mouse and
// keyboard even though an unselected movable piece shows no highlight.

import { PieceIcon, LAKE_SYMBOL_ID } from "../art/PieceIcon.tsx";
import { isLake, squareKey, type Square } from "../rules/primary/v1_1/board.ts";
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
  attackTargets,
  viewSide,
  type PlaySession,
} from "./playSession.ts";
import { fullBoardRows, visibleColumns } from "./boardView.ts";
import { sideColorName } from "./sideNames.ts";
import "./PlayBoard.css";

/**
 * Accessible label for one square: its name plus what occupies it, if
 * anything. `attack` (story 00000005, Step 7) marks a square as one of the
 * currently selected piece's legal *attack* targets - always an enemy-
 * occupied square - and is worded distinctly ("attack {color} {piece}") from
 * a plain occupied-square label, so a screen-reader user can tell an attack
 * target apart from a plain move target (an empty square, unchanged) or an
 * ordinarily-described piece before committing to an activation.
 */
function squareLabel(
  square: Square,
  piece: PlacedPiece | undefined,
  lake: boolean,
  selected: boolean,
  attack: boolean,
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
  if (attack) {
    return `${name}, attack ${occupant}`;
  }
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
 * The full 12x12 board, oriented to `viewSide(session)` (Step 4), drawn
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
  const side = viewSide(session);
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
  // The subset of `highlightedKeys` that are attacks rather than plain moves
  // (Step 5's `attackTargets` - empty with nothing selected), so the board
  // can render and label them distinctly from plain move destinations.
  const attackKeys = new Set(
    attackTargets(session).map((square) => squareKey(square)),
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
      const isAttack = attackKeys.has(key);
      const isDestination = highlightedKeys.has(key) && !isAttack;
      const activatable = activatableKeys.has(key);

      return {
        content: (
          <PlayBoardCell
            piece={piece}
            lake={lake}
            selected={selected}
            destination={isDestination}
            attack={isAttack}
          />
        ),
        label: squareLabel(square, piece, lake, selected, isAttack),
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
  /** A legal (plain-move) destination for the currently selected piece (amber fill, no border). */
  readonly destination: boolean;
  /**
   * A legal *attack* target for the currently selected piece (story
   * 00000005, Step 7) - always an enemy-occupied square. Mutually exclusive
   * with `destination`: rendered with its own fill/border treatment so a
   * sighted player can tell an attack apart from a plain move before
   * committing, distinct in turn from the amber focus ring.
   */
  readonly attack: boolean;
}

function PlayBoardCell({
  piece,
  lake,
  selected,
  destination,
  attack,
}: PlayBoardCellProps) {
  const classNames = ["play-board__square"];
  if (lake) {
    classNames.push("play-board__square--lake");
  }
  if (selected) {
    classNames.push("play-board__square--selected");
  } else if (attack) {
    classNames.push("play-board__square--attack");
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

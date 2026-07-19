// Presentational full 12x12 board (story 00000014, Step 7), extracted out of
// what used to be `PlayBoard.tsx` so the game reviewer (later steps of this
// story) can share it without depending on `PlaySession`. `PlayBoard.tsx` is
// now a thin adapter that derives this component's props from a
// `PlaySession`; the review screen will derive them from its own, much
// simpler `reviewSession`. Unlike the placement `Board` (Board.tsx), this
// draws the *full* 12x12 board - both armies fully visible, per Phase 2's
// perfect-information rule - through the reusable accessible grid (story
// 00000004, Step 5), so it is keyboard-operable and screen-reader-
// perceivable regardless of caller.
//
// This component knows nothing about whose turn it is or the move grammar
// (select/deselect/move): it only draws a `BoardState` from a given `side`'s
// perspective, renders whichever squares its caller marks as selected / a
// plain-move destination / an attack target / the last move made, and
// reports raw square activations up to the caller via `onActivate` for
// whichever squares the caller marks `activatableSquares`. The caller owns
// all of the domain meaning.
//
// Visual highlighting is deliberately minimal (Gate D revision, story
// 00000004): the only square-fill highlights are for an *in-progress
// selection* - the picked-up piece (`--selected`, dark ink), its legal
// plain-move destinations (`--destination`, an amber tint, background only,
// no border), and its legal *attack* targets (`--attack`, its own distinct
// fill/border treatment, story 00000005 Step 7) - always an enemy-occupied
// square, so a sighted player can tell an attack apart from a plain move
// before committing. With nothing selected/highlighted, no square shows any
// of these at all. The amber *border* is reserved exclusively for the
// keyboard-focus ring (AccessibleGrid.css's `:focus-visible`), so a fill and
// a border never read as the same thing, and `--attack` in turn never reads
// as a `--destination` or a focus ring.
//
// Story 00000014, Step 7 adds one more highlight, `lastMove`: the two
// squares (from and to) touched by the most recently made move, used by the
// review screen so "the last move made is evident on the board" (unused by
// the hot-seat game, which has no need to look backward at its own last move
// on the board itself - `playAnnouncement`/`GameRecord` cover that need
// elsewhere). Its treatment (`--last-move`, a muted forest-green fill/ring -
// see FullBoard.css) is deliberately unlike all three highlights above and
// the focus ring, so all of them stay visually distinct even if a future
// caller ever combined them.
//
// That visual set is strictly smaller than the set of squares that actually
// *respond* to activation: the accessible grid's activation gate
// (`GridCellDescriptor.actionable`) is driven directly by `activatableSquares`,
// not by any of the visual highlight sets above. An inert board - the review
// screen, or a finished/inert `PlaySession` - simply passes none: every
// square stays focusable and its label still describes what occupies it, but
// none responds to a click or Enter/Space.

import { PieceIcon, LAKE_SYMBOL_ID } from "../art/PieceIcon.tsx";
import {
  isLake,
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v1_1/board.ts";
import type {
  BoardState,
  PlacedPiece,
} from "../rules/primary/v1_1/gameState.ts";
import { PIECE_CATALOG } from "../rules/primary/v1_1/pieces.ts";
import {
  AccessibleGrid,
  type GridCellDescriptor,
} from "./grid/AccessibleGrid.tsx";
import type { GridPosition } from "./grid/gridNavigation.ts";
import { fullBoardRows, visibleColumns } from "./boardView.ts";
import { sideColorName } from "./sideNames.ts";
import "./FullBoard.css";

/**
 * Accessible label for one square: its name plus what occupies it, if
 * anything. `attack` (story 00000005, Step 7) marks a square as one of the
 * currently selected piece's legal *attack* targets - always an enemy-
 * occupied square - and is worded distinctly ("attack {color} {piece}") from
 * a plain occupied-square label, so a screen-reader user can tell an attack
 * target apart from a plain move target (an empty square, unchanged) or an
 * ordinarily-described piece before committing to an activation. `lastMove`
 * (story 00000014, Step 7) appends ", last move" so the square the reviewer
 * marks as the last move's source or destination is conveyed to assistive
 * technology, not just shown.
 */
function squareLabel(
  square: Square,
  piece: PlacedPiece | undefined,
  lake: boolean,
  selected: boolean,
  attack: boolean,
  lastMove: boolean,
): string {
  const name = squareKey(square);
  const suffix = lastMove ? ", last move" : "";
  if (lake) {
    return `${name}, lake${suffix}`;
  }
  if (piece === undefined) {
    return `${name}, empty${suffix}`;
  }
  const occupant = `${sideColorName(piece.side)} ${
    PIECE_CATALOG[piece.pieceType].displayName
  }`;
  if (attack) {
    return `${name}, attack ${occupant}${suffix}`;
  }
  return selected
    ? `${name}, ${occupant}, selected${suffix}`
    : `${name}, ${occupant}${suffix}`;
}

export interface FullBoardProps {
  /** The position to draw. */
  readonly board: BoardState;
  /** The side whose perspective the board is drawn from (see `boardView.ts`). */
  readonly side: Side;
  /** The square of a piece currently picked up, if any (hot-seat only). */
  readonly selected?: Square;
  /**
   * Legal plain-move destinations for the selected piece (hot-seat only).
   * Rendered with `--destination`'s amber fill; a square that is also in
   * `attackSquares` is rendered as an attack instead (see `attackSquares`).
   */
  readonly destinationSquares?: readonly Square[];
  /**
   * Legal attack targets for the selected piece (hot-seat only). Rendered
   * with `--attack`'s red fill/border, taking priority over
   * `destinationSquares` for any square in both.
   */
  readonly attackSquares?: readonly Square[];
  /**
   * The squares the most recently made move touched - its source and
   * destination - so the board can mark "the last move made" (story
   * 00000014's review screen). Left `undefined` by the hot-seat game.
   */
  readonly lastMove?: { readonly from: Square; readonly to: Square };
  /**
   * Squares that respond to activation (click, or Enter/Space when
   * focused). Every square stays focusable and readable regardless; an
   * empty/undefined set (a fully inert board, as in review) simply makes
   * every square a no-op when activated.
   */
  readonly activatableSquares?: readonly Square[];
  /**
   * Called with the domain square of an actionable cell when it is
   * activated. Omit for a fully inert board (review).
   */
  readonly onActivate?: (square: Square) => void;
  /** Text pushed into the board's polite live region. */
  readonly announcement?: string;
}

/**
 * The full 12x12 board, oriented to `side`, drawn through the accessible
 * grid (story 00000004, Step 5). See the module comment above for the
 * highlighting and activation contract.
 */
export function FullBoard({
  board,
  side,
  selected,
  destinationSquares = [],
  attackSquares = [],
  lastMove,
  activatableSquares = [],
  onActivate,
  announcement,
}: FullBoardProps) {
  const rows = fullBoardRows(side);
  const columns = visibleColumns(side);
  const attackKeys = new Set(attackSquares.map((square) => squareKey(square)));
  // A square that is both a plain-move destination and an attack target (in
  // practice never the case - a square is one or the other - but kept as an
  // explicit precedence rather than an assumption) renders as an attack.
  const destinationKeys = new Set(
    destinationSquares
      .map((square) => squareKey(square))
      .filter((key) => !attackKeys.has(key)),
  );
  const activatableKeys = new Set(
    activatableSquares.map((square) => squareKey(square)),
  );
  const selectedKey = selected ? squareKey(selected) : undefined;
  const lastMoveKeys = lastMove
    ? new Set([squareKey(lastMove.from), squareKey(lastMove.to)])
    : undefined;

  const cellRows: GridCellDescriptor[][] = rows.map((row) =>
    columns.map((column) => {
      const square: Square = { column, row };
      const key = squareKey(square);
      const lake = isLake(square);
      const piece = board[key];
      const isSelected = key === selectedKey;
      const isAttack = attackKeys.has(key);
      const isDestination = destinationKeys.has(key);
      const isLastMove = lastMoveKeys?.has(key) ?? false;
      const activatable = activatableKeys.has(key);

      return {
        content: (
          <FullBoardCell
            piece={piece}
            lake={lake}
            selected={isSelected}
            destination={isDestination}
            attack={isAttack}
            lastMove={isLastMove}
          />
        ),
        label: squareLabel(
          square,
          piece,
          lake,
          isSelected,
          isAttack,
          isLastMove,
        ),
        focusable: true,
        actionable: activatable,
      };
    }),
  );

  return (
    <AccessibleGrid
      label="Battlefield"
      rows={cellRows}
      className="full-board"
      announcement={announcement}
      onActivate={(position: GridPosition) =>
        onActivate?.({
          column: columns[position.column],
          row: rows[position.row],
        })
      }
    />
  );
}

interface FullBoardCellProps {
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
  /**
   * One of the last move's source/destination squares (story 00000014, Step
   * 7). Independent of the three flags above - see FullBoard.css's
   * `--last-move` for why its treatment stays distinct from each of them.
   */
  readonly lastMove: boolean;
}

function FullBoardCell({
  piece,
  lake,
  selected,
  destination,
  attack,
  lastMove,
}: FullBoardCellProps) {
  const classNames = ["full-board__square"];
  if (lake) {
    classNames.push("full-board__square--lake");
  }
  if (selected) {
    classNames.push("full-board__square--selected");
  } else if (attack) {
    classNames.push("full-board__square--attack");
  } else if (destination) {
    classNames.push("full-board__square--destination");
  }
  if (lastMove) {
    classNames.push("full-board__square--last-move");
  }

  return (
    <div className={classNames.join(" ")}>
      <div className="full-board__square-inner">
        {lake && (
          <svg
            viewBox="0 0 64 64"
            className="full-board__lake-icon"
            aria-hidden="true"
          >
            <use href={`#${LAKE_SYMBOL_ID}`} />
          </svg>
        )}
        {piece && (
          <PieceIcon
            type={piece.pieceType}
            side={piece.side}
            className="full-board__piece-icon"
          />
        )}
      </div>
    </div>
  );
}

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
// Story 00000019, Step 9 reuses `--destination` (not a new highlight) for the
// path of the computer's move while it slides: whenever `animatedMove` is
// set, every square that move's path touches - its `from`, its `to`, and (for
// a two-square move) the single square passed over between them, from
// `movePathSquares` (`boardView.ts`) - is marked with the same amber fill a
// human's own legal plain-move destinations use, so the path reads clearly on
// the small board. It is never an attack-style highlight (the computer's own
// move never reads as one of the human's own attack targets), and it appears
// only while `animatedMove` is set - the human's own turn, hot-seat, and
// review are all unaffected, since none of them ever pass `animatedMove`.
//
// That visual set is strictly smaller than the set of squares that actually
// *respond* to activation: the accessible grid's activation gate
// (`GridCellDescriptor.actionable`) is driven directly by `activatableSquares`,
// not by any of the visual highlight sets above. An inert board - the review
// screen, or a finished/inert `PlaySession` - simply passes none: every
// square stays focusable and its label still describes what occupies it, but
// none responds to a click or Enter/Space.

import type { CSSProperties } from "react";
import { PieceIcon, LAKE_SYMBOL_ID } from "../art/PieceIcon.tsx";
import {
  isLake,
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v1/board.ts";
import type { BoardState, PlacedPiece } from "../rules/primary/v1/gameState.ts";
import { PIECE_CATALOG } from "../rules/primary/v1/pieces.ts";
import {
  AccessibleGrid,
  type GridCellDescriptor,
} from "./grid/AccessibleGrid.tsx";
import type { GridPosition } from "./grid/gridNavigation.ts";
import {
  fullBoardDisplayPosition,
  fullBoardRows,
  movePathSquares,
  visibleColumns,
} from "./boardView.ts";
import { sideColorName } from "./sideNames.ts";
import "./FullBoard.css";

/**
 * How long the computer's move takes to visually slide from its origin
 * square to its destination (story 00000019, Step 9; revised down from an
 * initial 400ms to one third of a second after the owner's first look at the
 * slide). The single source of truth for the slide's timing: it drives the
 * CSS animation below (passed down as the `--slide-duration` custom
 * property) and is imported, not duplicated, by `EngineGame.tsx`'s timer
 * that clears `animatedMove` once the slide is done. A touch slower than a
 * typical UI animation on purpose - the board's squares are small
 * (`--square: clamp(28px, 6vmin, 64px)`, FullBoard.css).
 */
export const MOVE_SLIDE_DURATION_MS = 333;

/** Inline style carrying the slide overlay's CSS custom properties. */
interface SlideStyle extends CSSProperties {
  readonly "--slide-to-row": number;
  readonly "--slide-to-col": number;
  readonly "--slide-drow": number;
  readonly "--slide-dcol": number;
  readonly "--slide-duration": string;
}

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
  /**
   * The computer's just-applied move, mid-slide (story 00000019, Step 9).
   * `board` already reflects the move (the moved piece sits at `to`); while
   * this is set, `FullBoard` suppresses the real piece drawn at `to` and
   * instead renders a single `aria-hidden` sliding `PieceIcon` overlay that
   * travels from `from`'s display cell to `to`'s over
   * `MOVE_SLIDE_DURATION_MS`, landing exactly at rest so no jump is visible
   * once it settles. It also marks every square the move's path touches
   * (`from`, `to`, and, for a two-square move, the square passed over between
   * them - `movePathSquares`, `boardView.ts`) with the same amber
   * `--destination` fill a human's own legal plain-move destinations use, so
   * the `to` square shows that fill underneath the arriving piece. Purely
   * visual - the move is already announced through the live region elsewhere
   * (`playAnnouncement.ts`), so none of this carries accessible-name/live-
   * region semantics of its own. Default-off (`undefined`); omitted by
   * hot-seat, review, and the human's own moves, all of which are unaffected.
   * Honors `prefers-reduced-motion: reduce` (FullBoard.css) as a
   * defense-in-depth safety net, though `EngineGame.tsx` is expected to never
   * set this prop at all when the user prefers reduced motion, so the board
   * is never needlessly held inert for a slide nobody will see.
   */
  readonly animatedMove?: { readonly from: Square; readonly to: Square };
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
  animatedMove,
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
  // The moved piece is suppressed at its real square (`to`) while it's drawn
  // instead as the sliding overlay below, so the two are never both visible
  // at once (story 00000019, Step 9). `board` already reflects the move (it
  // was applied before the slide begins - see `EngineGame.tsx`), so the piece
  // to slide is read from `board[to]`, not from anything about `from`.
  const animatedToKey = animatedMove ? squareKey(animatedMove.to) : undefined;
  const slidingPiece = animatedMove
    ? board[squareKey(animatedMove.to)]
    : undefined;
  // The path the computer's move is sliding along - `from`, `to`, and (for a
  // two-square move) the square passed over between them - marked with the
  // same amber `--destination` fill a human's own legal plain-move
  // destinations use, for exactly the slide's lifetime (see the module
  // comment and this component's own `animatedMove` doc comment above).
  const animatedPathKeys = animatedMove
    ? new Set(
        movePathSquares(animatedMove.from, animatedMove.to).map(squareKey),
      )
    : undefined;

  const cellRows: GridCellDescriptor[][] = rows.map((row) =>
    columns.map((column) => {
      const square: Square = { column, row };
      const key = squareKey(square);
      const lake = isLake(square);
      const piece = board[key];
      const isSelected = key === selectedKey;
      const isAttack = attackKeys.has(key);
      const isDestination =
        destinationKeys.has(key) || (animatedPathKeys?.has(key) ?? false);
      const isLastMove = lastMoveKeys?.has(key) ?? false;
      const activatable = activatableKeys.has(key);
      const hidePiece = key === animatedToKey;

      return {
        content: (
          <FullBoardCell
            piece={hidePiece ? undefined : piece}
            lake={lake}
            selected={isSelected}
            destination={isDestination}
            attack={isAttack}
            lastMove={isLastMove}
          />
        ),
        // The accessible label always describes the real occupant, whether
        // or not its icon is momentarily hidden for the slide - the overlay
        // is purely visual and carries no label of its own (see its own
        // `aria-hidden`, below), so assistive technology is unaffected by
        // it either way.
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

  const slideStyle: SlideStyle | undefined =
    animatedMove && slidingPiece
      ? (() => {
          const from = fullBoardDisplayPosition(side, animatedMove.from);
          const to = fullBoardDisplayPosition(side, animatedMove.to);
          return {
            "--slide-to-row": to.row,
            "--slide-to-col": to.column,
            "--slide-drow": from.row - to.row,
            "--slide-dcol": from.column - to.column,
            "--slide-duration": `${MOVE_SLIDE_DURATION_MS}ms`,
          };
        })()
      : undefined;

  return (
    // `.full-board__stage` wraps the grid (rather than the slide overlay
    // living inside any one square) because a square's own `overflow:
    // hidden` (FullBoard.css) would clip the sliding piece mid-flight, since
    // for most of the animation it sits outside its destination square's
    // box. The stage, not `.full-board` itself, is where `--square` and the
    // board's border width are declared (FullBoard.css), so the grid and the
    // overlay always agree on cell geometry from one source.
    <div className="full-board__stage">
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
      {slideStyle && slidingPiece && (
        <div
          className="full-board__slide-piece"
          style={slideStyle}
          aria-hidden="true"
        >
          <PieceIcon
            type={slidingPiece.pieceType}
            side={slidingPiece.side}
            className="full-board__slide-piece-icon"
          />
        </div>
      )}
    </div>
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

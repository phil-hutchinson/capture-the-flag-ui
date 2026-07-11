// Phase 2 interaction & turn state machine (story 00000004, Step 6).
//
// This module has no React dependency: it is a small, pure orchestration
// layer that sits between the rule layer (`movement.ts`, `play.ts`) and the
// UI. It owns the *current* `PlayState` (whose turn it is, the board, the
// move record) plus one extra piece of interaction state the rule layer
// itself does not need to know about: which of the side-to-move's own
// pieces, if any, is currently picked up ("selected").
//
// The UI only ever calls `activateSquare` when a board cell is activated
// (clicked, or Enter/Space on the focused cell) - it never calls `applyMove`
// directly and never decides for itself whether a square is legal. That
// keeps illegal moves structurally unrepresentable, mirroring the placement
// flow: `actionableSquares` tells the UI exactly which cells are
// *highlighted* as legal for the current selection state (own movable
// pieces when nothing is selected, the selected piece's legal destinations
// once one is) - this drives the board's visual highlight styling only.
// `activateSquare` accepts a strictly larger set of squares than that
// highlight set: while a piece is selected, reactivating that same piece
// (deselect) and activating any *other* own movable piece (switch
// selection) are also not no-ops, even though neither is a highlighted
// destination. `activatableSquares` is the exact set of squares for which
// `activateSquare` would return a different session - the UI (`PlayBoard`)
// uses it, not `actionableSquares`, to decide which cells actually respond
// to a click or Enter/Space, so deselect and switch-selection are reachable
// by mouse and keyboard alike. Any square outside both sets - an opponent's
// piece, an immobile own piece, a lake, an empty non-destination square - is
// a no-op.
//
// Passing is never an operation: there is no "skip turn" here. If the side
// to move has no legal move at all, `actionableSquares` simply returns an
// empty array (the accepted "stuck" rough edge for this story - see
// story.md; no crash, no special handling - the real handling is story
// 00000006).

import {
  allSquares,
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v1_1/board.ts";
import type {
  BoardState,
  InitialGameState,
} from "../rules/primary/v1_1/gameState.ts";
import { legalDestinations } from "../rules/primary/v1_1/movement.ts";
import {
  applyMove,
  startPlay,
  type PlayState,
} from "../rules/primary/v1_1/play.ts";

/**
 * The Phase-2 session's state: the current `PlayState` plus the active
 * player's current selection - the square of the own piece currently picked
 * up, or `null` if nothing is selected. Selection is always cleared by a
 * completed move (and by re-activating the selected piece), and always
 * belongs to `play.sideToMove` while it is non-`null`.
 */
export interface PlaySession {
  readonly play: PlayState;
  readonly selection: Square | null;
}

/** A fresh Phase-2 session starting from `initial` (story 00000001's artifact). */
export function startSession(initial: InitialGameState): PlaySession {
  return { play: startPlay(initial), selection: null };
}

/**
 * True if `square` holds one of `side`'s own pieces that has at least one
 * legal destination right now - i.e. a piece the UI may usefully offer for
 * selection. Excludes immobile piece types (Tower, Flag - `legalDestinations`
 * already returns none for those) and pieces that are movable in principle
 * but currently boxed in by lakes/other pieces.
 */
function isOwnMovablePiece(
  board: BoardState,
  side: Side,
  square: Square,
): boolean {
  const piece = board[squareKey(square)];
  return (
    piece !== undefined &&
    piece.side === side &&
    legalDestinations(board, square).length > 0
  );
}

/**
 * The set of squares that may usefully be activated right now: with nothing
 * selected, the side-to-move's own movable pieces; with a piece selected,
 * that piece's legal destinations (Step 1). If the side to move is stuck
 * with no legal move anywhere, this is simply empty - never throws.
 */
export function actionableSquares(session: PlaySession): Square[] {
  const { play, selection } = session;
  if (selection !== null) {
    return legalDestinations(play.board, selection);
  }
  return allSquares().filter((square) =>
    isOwnMovablePiece(play.board, play.sideToMove, square),
  );
}

/**
 * The set of squares whose activation is *not* a no-op right now - i.e.
 * exactly the squares for which `activateSquare(session, square)` returns a
 * different session. This is a superset of `actionableSquares` while a piece
 * is selected: it is the side-to-move's own movable pieces (which includes
 * the currently selected piece itself, since it was only selectable because
 * it is one - reactivating it is how deselection is reached) unioned with
 * the selected piece's legal destinations. With nothing selected it is
 * exactly the side-to-move's own movable pieces, same as `actionableSquares`.
 * The UI (`PlayBoard.tsx`) uses this - not `actionableSquares` - to decide
 * which cells respond to a click or Enter/Space, so switching the selection
 * to a different own piece and deselecting the current one are reachable by
 * mouse and keyboard alike; `actionableSquares` continues to drive only the
 * visual highlight.
 */
export function activatableSquares(session: PlaySession): Square[] {
  const { play, selection } = session;
  const ownMovable = allSquares().filter((square) =>
    isOwnMovablePiece(play.board, play.sideToMove, square),
  );
  if (selection === null) {
    return ownMovable;
  }
  return [...ownMovable, ...legalDestinations(play.board, selection)];
}

/**
 * Handles activating a board cell (click, or Enter/Space on the focused
 * cell) and returns the resulting `PlaySession`:
 *
 * - Nothing selected, `square` is one of the side-to-move's own movable
 *   pieces: selects it.
 * - A piece is selected and `square` is that same piece's square:
 *   deselects it (no other change).
 * - A piece is selected and `square` is one of its legal destinations:
 *   applies the move (flips the side to move, appends the move record) and
 *   clears the selection.
 * - A piece is selected and `square` is a *different* own movable piece:
 *   switches the selection to that piece (does not move, does not
 *   deselect) - `actionableSquares` then reflects the newly selected
 *   piece's own legal destinations.
 * - Anything else - an opponent's piece, an immobile own piece, a lake, an
 *   empty non-destination square, or (with nothing selected) any square that
 *   is not one of the side-to-move's own movable pieces - is a no-op: the
 *   returned session is unchanged.
 */
export function activateSquare(
  session: PlaySession,
  square: Square,
): PlaySession {
  const { play, selection } = session;

  if (selection !== null) {
    if (squareKey(square) === squareKey(selection)) {
      return { play, selection: null };
    }
    const destinations = legalDestinations(play.board, selection);
    if (destinations.some((d) => squareKey(d) === squareKey(square))) {
      return {
        play: applyMove(play, selection, square).state,
        selection: null,
      };
    }
    if (isOwnMovablePiece(play.board, play.sideToMove, square)) {
      return { play, selection: square };
    }
    return session;
  }

  if (isOwnMovablePiece(play.board, play.sideToMove, square)) {
    return { play, selection: square };
  }
  return session;
}

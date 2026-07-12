// Phase 2 interaction & turn state machine (story 00000004, Step 6; extended
// for attacks in story 00000005, Step 5).
//
// This module has no React dependency: it is a small, pure orchestration
// layer that sits between the rule layer (`movement.ts`, `play.ts`,
// `combat.ts`) and the UI. It owns the *current* `PlayState` (whose turn it
// is, the board, the move record), the most recently resolved `PlyOutcome`
// (so the announcement layer, Step 6, can describe what the last ply did),
// and one extra piece of interaction state the rule layer itself does not
// need to know about: which of the side-to-move's own pieces, if any, is
// currently picked up ("selected").
//
// The UI only ever calls `activateSquare` when a board cell is activated
// (clicked, or Enter/Space on the focused cell) - it never calls `applyMove`
// directly and never decides for itself whether a square is legal. That
// keeps illegal moves and attacks structurally unrepresentable, mirroring the
// placement flow: `actionableSquares` tells the UI exactly which cells are
// *highlighted* as legal for the current selection state (own movable pieces
// when nothing is selected, the selected piece's legal destinations *and*
// legal attack targets once one is) - this drives the board's visual
// highlight styling only. `activateSquare` accepts a strictly larger set of
// squares than that highlight set: while a piece is selected, reactivating
// that same piece (deselect) and activating any *other* own movable piece
// (switch selection) are also not no-ops, even though neither is a
// highlighted destination. `activatableSquares` is the exact set of squares
// for which `activateSquare` would return a different session - the UI
// (`PlayBoard`) uses it, not `actionableSquares`, to decide which cells
// actually respond to a click or Enter/Space, so deselect and
// switch-selection are reachable by mouse and keyboard alike. Any square
// outside both sets - an opponent's piece, an immobile own piece, a lake, an
// empty non-destination square - is a no-op. `attackTargets` exposes exactly
// which of the selected piece's actionable squares are attacks (as opposed to
// plain moves), so `PlayBoard` (Step 7) can render and label them
// differently without re-deriving intent.
//
// Passing is never an operation: there is no "skip turn" here. If the side
// to move has no legal move *or attack* at all, `actionableSquares` simply
// returns an empty array - and, per story 00000006's `outcome.ts`, this is
// now itself a detected game-ending condition (§6.3), so `play.result` is
// already a finished game by the time this can be observed.
//
// Story 00000006, Step 6 extends this state machine with two more ways the
// board goes deliberately quiet: the game having ended (`play.result.kind
// !== "ongoing"`), and a draw offer (§6.6) awaiting the opponent's answer
// (`drawOffer`). In either case the board is *inert* - `actionableSquares`
// and `activatableSquares` are empty and `activateSquare` is a no-op - via
// the private `isInert` helper, so no new "disabled" flag threads through
// the UI. A pending offer never changes `play.sideToMove`.

import {
  allSquares,
  otherSide,
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v1_1/board.ts";
import type {
  BoardState,
  InitialGameState,
} from "../rules/primary/v1_1/gameState.ts";
import {
  legalAttacks,
  legalDestinations,
} from "../rules/primary/v1_1/movement.ts";
import {
  agreeDraw,
  applyMove,
  startPlay,
  type PlayState,
  type PlyOutcome,
} from "../rules/primary/v1_1/play.ts";

/**
 * The Phase-2 session's state: the current `PlayState`, the active player's
 * current selection - the square of the own piece currently picked up, or
 * `null` if nothing is selected - the most recently resolved `PlyOutcome`
 * (`null` before any ply is applied), and the pending draw offer (story
 * 00000006, Step 6): the `Side` that has offered a draw and is awaiting the
 * opponent's answer, or `null` if none is pending. Selection is always
 * cleared by a completed ply (move or attack; and by re-activating the
 * selected piece) and by making a draw offer, and always belongs to
 * `play.sideToMove` while it is non-`null`. `lastOutcome` is overwritten
 * whenever `activateSquare` applies a ply, and left unchanged by every other
 * transition (selection, deselection, switching selection, draw-offer
 * transitions, and no-ops) - it is only meaningful to read immediately after
 * a ply, which is exactly how Step 6's announcement uses it. A pending draw
 * offer never changes `play.sideToMove` (rules.md §6.6: an offer never
 * replaces or skips a move) - the turn is still the offerer's to take if the
 * offer is declined. The board's orientation is a separate question from
 * whose turn it is; see `viewSide`.
 */
export interface PlaySession {
  readonly play: PlayState;
  readonly selection: Square | null;
  readonly lastOutcome: PlyOutcome | null;
  readonly drawOffer: Side | null;
}

/** A fresh Phase-2 session starting from `initial` (story 00000001's artifact). */
export function startSession(initial: InitialGameState): PlaySession {
  return {
    play: startPlay(initial),
    selection: null,
    lastOutcome: null,
    drawOffer: null,
  };
}

/**
 * True while the board must be **inert** - no cell selectable or activatable
 * - because the game has ended (`play.result.kind !== "ongoing"`) or a draw
 * offer is currently pending an answer. `actionableSquares`,
 * `activatableSquares`, and `activateSquare` all consult this rather than
 * threading a separate "disabled" flag through the UI: an inert board simply
 * offers nothing to select and responds to nothing.
 */
function isInert(session: PlaySession): boolean {
  return session.play.result.kind !== "ongoing" || session.drawOffer !== null;
}

/**
 * The side whose perspective the board is drawn from - the player who is
 * actually sitting at the board right now, which is not always the side to
 * move (story 00000006, Step 13).
 *
 * Ordinarily that is `play.sideToMove`: the active player sees their own home
 * edge nearest them, and the board flips at each hand-off. The exception is a
 * **pending draw offer**. An offer does not change `sideToMove` (the turn
 * remains the offerer's to take if declined), but it does hand the physical
 * board to the *opponent*, who must answer Accept or Decline - so the board is
 * drawn from **their** perspective while they answer. Answering ends the
 * exception and orientation reverts to `sideToMove`: on a decline that is the
 * offerer, who now takes their turn; on an accept the game is over and the
 * final position is shown to the side to move, exactly as it is for every
 * other ending.
 */
export function viewSide(session: PlaySession): Side {
  return session.drawOffer === null
    ? session.play.sideToMove
    : otherSide(session.drawOffer);
}

/**
 * True if `square` holds one of `side`'s own pieces that has at least one
 * legal destination *or* legal attack right now - i.e. a piece the UI may
 * usefully offer for selection. Excludes immobile piece types (Tower, Flag -
 * both `legalDestinations` and `legalAttacks` already return none for those)
 * and pieces that are movable/able to attack in principle but currently
 * boxed in by lakes, friendly pieces, or (for movement) any piece at all.
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
    (legalDestinations(board, square).length > 0 ||
      legalAttacks(board, square).length > 0)
  );
}

/**
 * The set of squares that may usefully be activated right now: with nothing
 * selected, the side-to-move's own movable pieces; with a piece selected,
 * that piece's legal destinations *and* legal attack targets (Step 1 of
 * story 00000004, extended by Step 3/5 of story 00000005). If the side to
 * move is stuck with no legal move or attack anywhere, this is simply empty -
 * never throws. **Empty** whenever the board is inert (story 00000006, Step
 * 6) - the game has ended, or a draw offer is pending an answer.
 */
export function actionableSquares(session: PlaySession): Square[] {
  if (isInert(session)) {
    return [];
  }
  const { play, selection } = session;
  if (selection !== null) {
    return [
      ...legalDestinations(play.board, selection),
      ...legalAttacks(play.board, selection),
    ];
  }
  return allSquares().filter((square) =>
    isOwnMovablePiece(play.board, play.sideToMove, square),
  );
}

/**
 * The subset of the selected piece's `actionableSquares` that are **attack**
 * targets, as opposed to plain move targets - i.e.
 * `legalAttacks(session.play.board, session.selection)` when a piece is
 * selected, or an empty array when nothing is. `PlayBoard` (Step 7) uses this
 * to render and label attack targets distinctly from plain move targets,
 * without re-deriving which is which. **Empty** whenever the board is inert
 * (story 00000006, Step 6) - the game has ended, or a draw offer is pending
 * an answer - matching `actionableSquares`/`activatableSquares`, by contract
 * rather than merely because a completed or ending ply happens to leave
 * `selection === null`.
 */
export function attackTargets(session: PlaySession): Square[] {
  if (isInert(session)) {
    return [];
  }
  const { play, selection } = session;
  if (selection === null) {
    return [];
  }
  return legalAttacks(play.board, selection);
}

/**
 * The set of squares whose activation is *not* a no-op right now - i.e.
 * exactly the squares for which `activateSquare(session, square)` returns a
 * different session. This is a superset of `actionableSquares` while a piece
 * is selected: it is the side-to-move's own movable pieces (which includes
 * the currently selected piece itself, since it was only selectable because
 * it is one - reactivating it is how deselection is reached) unioned with
 * the selected piece's legal destinations *and* legal attack targets. With
 * nothing selected it is exactly the side-to-move's own movable pieces, same
 * as `actionableSquares`. The UI (`PlayBoard.tsx`) uses this - not
 * `actionableSquares` - to decide which cells respond to a click or
 * Enter/Space, so switching the selection to a different own piece and
 * deselecting the current one are reachable by mouse and keyboard alike;
 * `actionableSquares` continues to drive only the visual highlight. **Empty**
 * whenever the board is inert (story 00000006, Step 6) - the game has ended,
 * or a draw offer is pending an answer.
 */
export function activatableSquares(session: PlaySession): Square[] {
  if (isInert(session)) {
    return [];
  }
  const { play, selection } = session;
  const ownMovable = allSquares().filter((square) =>
    isOwnMovablePiece(play.board, play.sideToMove, square),
  );
  if (selection === null) {
    return ownMovable;
  }
  return [
    ...ownMovable,
    ...legalDestinations(play.board, selection),
    ...legalAttacks(play.board, selection),
  ];
}

/**
 * Handles activating a board cell (click, or Enter/Space on the focused
 * cell) and returns the resulting `PlaySession`:
 *
 * - Nothing selected, `square` is one of the side-to-move's own movable
 *   pieces: selects it.
 * - A piece is selected and `square` is that same piece's square:
 *   deselects it (no other change).
 * - A piece is selected and `square` is one of its legal destinations or
 *   legal attack targets: applies the ply (flips the side to move, appends
 *   the move record, and - for an attack - resolves combat and updates the
 *   board per its outcome), records the resolved `PlyOutcome` as
 *   `lastOutcome`, and clears the selection.
 * - A piece is selected and `square` is a *different* own movable piece:
 *   switches the selection to that piece (does not move, does not
 *   deselect) - `actionableSquares` then reflects the newly selected
 *   piece's own legal destinations and attack targets.
 * - Anything else - an opponent's piece, an immobile own piece, a lake, an
 *   empty non-destination square, or (with nothing selected) any square that
 *   is not one of the side-to-move's own movable pieces - is a no-op: the
 *   returned session is unchanged.
 *
 * A **no-op** in every case, regardless of `square`, when the board is inert
 * (story 00000006, Step 6) - the game has already ended, or a draw offer is
 * pending an answer: nothing may be selected or moved until the offer is
 * resolved.
 */
export function activateSquare(
  session: PlaySession,
  square: Square,
): PlaySession {
  if (isInert(session)) {
    return session;
  }

  const { play, selection, lastOutcome, drawOffer } = session;

  if (selection !== null) {
    if (squareKey(square) === squareKey(selection)) {
      return { play, selection: null, lastOutcome, drawOffer };
    }
    const destinations = legalDestinations(play.board, selection);
    const attacks = legalAttacks(play.board, selection);
    const isTarget =
      destinations.some((d) => squareKey(d) === squareKey(square)) ||
      attacks.some((a) => squareKey(a) === squareKey(square));
    if (isTarget) {
      const applied = applyMove(play, selection, square);
      return {
        play: applied.state,
        selection: null,
        lastOutcome: applied.outcome,
        drawOffer: null,
      };
    }
    if (isOwnMovablePiece(play.board, play.sideToMove, square)) {
      return { play, selection: square, lastOutcome, drawOffer };
    }
    return session;
  }

  if (isOwnMovablePiece(play.board, play.sideToMove, square)) {
    return { play, selection: square, lastOutcome, drawOffer };
  }
  return session;
}

/**
 * Offers a draw (rules.md §6.6) on behalf of the current side to move,
 * recording it as the pending `drawOffer` and clearing any current
 * selection - the board goes inert (per `isInert`) the moment an offer is
 * made, so a piece mid-selection is picked back up. Does **not** change
 * `play.sideToMove`: an offer never replaces or skips a move. A **no-op**
 * (returns `session` unchanged) if the game has already ended or an offer is
 * already pending - the UI never offers this action in either case (Step 9's
 * end-of-game panel and Step 11's draw-offer control both gate on it).
 */
export function offerDraw(session: PlaySession): PlaySession {
  if (session.play.result.kind !== "ongoing" || session.drawOffer !== null) {
    return session;
  }
  return {
    play: session.play,
    selection: null,
    lastOutcome: session.lastOutcome,
    drawOffer: session.play.sideToMove,
  };
}

/**
 * Accepts the pending draw offer, ending the game immediately as a draw by
 * **agreement** via `play.ts`'s `agreeDraw` (Step 4), and clears the pending
 * offer. The board remains inert afterward - not because an offer is
 * pending, but because the game is now over (`isInert` checks `result` first).
 * A **no-op** if no offer is pending.
 */
export function acceptDraw(session: PlaySession): PlaySession {
  if (session.drawOffer === null) {
    return session;
  }
  return {
    play: agreeDraw(session.play),
    selection: session.selection,
    lastOutcome: session.lastOutcome,
    drawOffer: null,
  };
}

/**
 * Declines the pending draw offer: clears it and returns play to the
 * offering player, who still has their turn - `play.sideToMove` is
 * unchanged, since a draw offer never occupied a turn. Quiet, per rules.md
 * §6.6: no counter change, no move appended, no penalty - `play` itself is
 * untouched. Restores the board to normal (actionable/activatable) once the
 * offer is cleared, so the offering player can then move as usual. A
 * **no-op** if no offer is pending.
 */
export function declineDraw(session: PlaySession): PlaySession {
  if (session.drawOffer === null) {
    return session;
  }
  return {
    play: session.play,
    selection: session.selection,
    lastOutcome: session.lastOutcome,
    drawOffer: null,
  };
}

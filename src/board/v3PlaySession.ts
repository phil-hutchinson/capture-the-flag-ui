// Ruleset major 3's interaction & turn state machine (story 00000036, Step
// 13, implementation plan Decision 1) - the major-3 counterpart of
// `playSession.ts`, deliberately duplicated rather than shared: the two
// majors' legality, endings, and declared actions (major 3 has a resign
// control major 2 does not; major 2 has a Tower placement phase major 3 does
// not) are different enough that a shared abstraction over them would be a
// leaky union of both vocabularies for no real gain (Decision 1).
//
// This module has no React dependency: it is a small, pure orchestration
// layer sitting between the v3 rule layer (`movement.ts`, `play.ts`,
// `combat.ts`) and the UI. It owns the *current* `PlayState`, the most
// recently resolved `PlyOutcome` (so `v3PlayAnnouncement.ts` can describe
// what the last ply did), and one extra piece of interaction state the rule
// layer does not need to know about: which of the side-to-move's own
// pieces, if any, is currently picked up ("selected").
//
// The UI only ever calls `activateSquare` when a board cell is activated
// (clicked, or Enter/Space on the focused cell) - it never calls
// `applyMove` directly and never decides for itself whether a square is
// legal, exactly as `playSession.ts` works at major 2. `actionableSquares`
// tells the UI exactly which cells are *highlighted* as legal for the
// current selection state; `activateSquare` accepts a strictly larger set of
// squares than that - reactivating the selected piece (deselect) and
// activating a *different* own movable piece (switch selection) are also not
// no-ops. `activatableSquares` is the exact set of squares for which
// `activateSquare` would return a different session - the UI uses it, not
// `actionableSquares`, to decide which cells actually respond to a click or
// Enter/Space.
//
// Passing is never an operation (rules.md §4.1) - major 3 has no "no legal
// move" ending at all (`outcome.ts`'s attrition replaces it); a side with at
// least one numbered piece always has a legal move.
//
// The board goes deliberately quiet - `actionableSquares` and
// `activatableSquares` empty, `activateSquare` a no-op - once the game has
// ended (`play.result.kind !== "ongoing"`) or a draw offer (rules.md §5.6) is
// awaiting an answer (`drawOffer`), via the private `isInert` helper. A
// pending offer never changes `play.sideToMove`.
//
// **Resignation** (rules.md §5.5, this plan's Decision 9) is new at major 3:
// `resign` ends the game immediately as a win for the opponent of whichever
// side is currently to move - it needs no acceptance, cannot be declined, and
// is available at any point while the game is ongoing (a no-op once the
// board is already inert). It is a declaration, not a ply: no move is
// appended, and the side to move is unaffected until the game-ended check
// (`isInert`) takes over.
//
// Keep in step with `playSession.ts` (peer review, Minor 6): aside from the
// legality argument (this module's `firstMoveRestricted` where major 2's
// takes a `configuration`/`layout`) and the extra `resign` transition above,
// this is a near-verbatim duplicate of that module - same select/deselect/
// switch/apply grammar, same inert rules, same `viewSide` and draw-offer
// transitions. A behavioural fix to one of the two almost certainly belongs
// in both; nothing currently enforces that, so check the other module by
// hand.

import {
  allSquares,
  otherSide,
  squareKey,
  type Side,
  type Square,
} from "../rules/primary/v3/board.ts";
import {
  legalAttacks,
  legalDestinations,
} from "../rules/primary/v3/movement.ts";
import { pieceAt, type PositionState } from "../rules/primary/v3/position.ts";
import {
  agreeDraw,
  applyMove,
  resign as declareResignation,
  startPlay,
  type PlayState,
  type PlyOutcome,
} from "../rules/primary/v3/play.ts";
import type { GeneratedStartPosition } from "../rules/primary/v3/startPosition.ts";

/**
 * The major-3 session's state: the current `PlayState`, the active player's
 * current selection (the square of the own piece currently picked up, or
 * `null`), the most recently resolved `PlyOutcome` (`null` before any ply is
 * applied), and the pending draw offer: the `Side` that has offered a draw
 * and is awaiting the opponent's answer, or `null` if none is pending.
 * Selection is always cleared by a completed ply (move or attack; and by
 * re-activating the selected piece), by making a draw offer, and by
 * resigning, and always belongs to `play.sideToMove` while it is non-`null`.
 * `lastOutcome` is overwritten whenever `activateSquare` applies a ply, and
 * left unchanged by every other transition. A pending draw offer never
 * changes `play.sideToMove` - the turn is still the offerer's to take if the
 * offer is declined.
 */
export interface PlaySession {
  readonly play: PlayState;
  readonly selection: Square | null;
  readonly lastOutcome: PlyOutcome | null;
  readonly drawOffer: Side | null;
}

/** A fresh major-3 session starting from `generated` (`startPosition.ts`'s freshly generated position). */
export function startSession(generated: GeneratedStartPosition): PlaySession {
  return {
    play: startPlay(generated),
    selection: null,
    lastOutcome: null,
    drawOffer: null,
  };
}

/**
 * True while the board must be **inert** - no cell selectable or
 * activatable, and resigning a no-op - because the game has ended or a draw
 * offer is currently pending an answer.
 */
function isInert(session: PlaySession): boolean {
  return session.play.result.kind !== "ongoing" || session.drawOffer !== null;
}

/**
 * True iff `state` has not yet had a move applied to it - the one moment
 * rules.md §4.1's first-move restriction bites (White always moves first).
 * Mirrors `play.ts`'s own private `isFirstMoveOfGame`, restated here (a
 * one-line read of `state.moves.length`, not rules logic of its own) so this
 * module's own legality queries (`legalDestinations`/`legalAttacks`, used to
 * compute what to *offer*) agree with what `applyMove` will actually accept.
 */
function isFirstMoveOfGame(play: PlayState): boolean {
  return play.moves.length === 0;
}

/**
 * The side whose perspective the board is drawn from - mirrors
 * `playSession.ts`'s `viewSide` exactly. `flipBetweenTurns` defaults to
 * `true`; every production caller passes the player's "Flip board between
 * turns" setting explicitly.
 *
 * - **`true`**: ordinarily `play.sideToMove`; while a draw offer is pending,
 *   the *opponent* of the offerer (who must answer Accept or Decline), so the
 *   board is drawn from their perspective while they answer.
 * - **`false`**: always `"white"` (red), regardless of `sideToMove` and any
 *   pending draw offer.
 */
export function viewSide(session: PlaySession, flipBetweenTurns = true): Side {
  if (!flipBetweenTurns) {
    return "white";
  }
  return session.drawOffer === null
    ? session.play.sideToMove
    : otherSide(session.drawOffer);
}

/**
 * True if `square` holds one of `side`'s own pieces that has at least one
 * legal destination *or* legal attack right now - i.e. a piece the UI may
 * usefully offer for selection. Excludes the Flag (never mobile) and pieces
 * that are boxed in by friendly pieces or the board's edge.
 */
function isOwnMovablePiece(
  board: PositionState,
  side: Side,
  square: Square,
  firstMoveRestricted: boolean,
): boolean {
  const piece = pieceAt(board, square);
  return (
    piece !== undefined &&
    piece.side === side &&
    (legalDestinations(board, square, firstMoveRestricted).length > 0 ||
      legalAttacks(board, square, firstMoveRestricted).length > 0)
  );
}

/**
 * The set of squares that may usefully be activated right now: with nothing
 * selected, the side-to-move's own movable pieces; with a piece selected,
 * that piece's legal destinations *and* legal attack targets. **Empty**
 * whenever the board is inert.
 */
export function actionableSquares(session: PlaySession): Square[] {
  if (isInert(session)) {
    return [];
  }
  const { play, selection } = session;
  const firstMoveRestricted = isFirstMoveOfGame(play);
  if (selection !== null) {
    return [
      ...legalDestinations(play.board, selection, firstMoveRestricted),
      ...legalAttacks(play.board, selection, firstMoveRestricted),
    ];
  }
  return allSquares().filter((square) =>
    isOwnMovablePiece(play.board, play.sideToMove, square, firstMoveRestricted),
  );
}

/**
 * The subset of the selected piece's `actionableSquares` that are **attack**
 * targets, as opposed to plain move targets - so the UI can render and label
 * them differently without re-deriving intent. **Empty** whenever the board
 * is inert or nothing is selected.
 */
export function attackTargets(session: PlaySession): Square[] {
  if (isInert(session)) {
    return [];
  }
  const { play, selection } = session;
  if (selection === null) {
    return [];
  }
  return legalAttacks(play.board, selection, isFirstMoveOfGame(play));
}

/**
 * The set of squares whose activation is *not* a no-op right now - i.e.
 * exactly the squares for which `activateSquare(session, square)` returns a
 * different session. A superset of `actionableSquares` while a piece is
 * selected: the side-to-move's own movable pieces (including the currently
 * selected piece itself - reactivating it is how deselection is reached)
 * unioned with the selected piece's legal destinations and attack targets.
 * **Empty** whenever the board is inert.
 */
export function activatableSquares(session: PlaySession): Square[] {
  if (isInert(session)) {
    return [];
  }
  const { play, selection } = session;
  const firstMoveRestricted = isFirstMoveOfGame(play);
  const ownMovable = allSquares().filter((square) =>
    isOwnMovablePiece(play.board, play.sideToMove, square, firstMoveRestricted),
  );
  if (selection === null) {
    return ownMovable;
  }
  return [
    ...ownMovable,
    ...legalDestinations(play.board, selection, firstMoveRestricted),
    ...legalAttacks(play.board, selection, firstMoveRestricted),
  ];
}

/**
 * Handles activating a board cell (click, or Enter/Space on the focused
 * cell) and returns the resulting `PlaySession` - mirrors
 * `playSession.ts`'s `activateSquare` exactly:
 *
 * - Nothing selected, `square` is one of the side-to-move's own movable
 *   pieces: selects it.
 * - A piece is selected and `square` is that same piece's square:
 *   deselects it.
 * - A piece is selected and `square` is one of its legal destinations or
 *   legal attack targets: applies the ply (`play.ts`'s `applyMove` - flips
 *   the side to move, appends the move record, and, for an attack, resolves
 *   combat including any demotion), records the resolved `PlyOutcome` as
 *   `lastOutcome`, and clears the selection.
 * - A piece is selected and `square` is a *different* own movable piece:
 *   switches the selection to that piece.
 * - Anything else is a no-op.
 *
 * A **no-op** in every case, regardless of `square`, when the board is
 * inert - the game has already ended, or a draw offer is pending an answer.
 */
export function activateSquare(
  session: PlaySession,
  square: Square,
): PlaySession {
  if (isInert(session)) {
    return session;
  }

  const { play, selection, lastOutcome, drawOffer } = session;
  const firstMoveRestricted = isFirstMoveOfGame(play);

  if (selection !== null) {
    if (squareKey(square) === squareKey(selection)) {
      return { play, selection: null, lastOutcome, drawOffer };
    }
    const destinations = legalDestinations(
      play.board,
      selection,
      firstMoveRestricted,
    );
    const attacks = legalAttacks(play.board, selection, firstMoveRestricted);
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
    if (
      isOwnMovablePiece(
        play.board,
        play.sideToMove,
        square,
        firstMoveRestricted,
      )
    ) {
      return { play, selection: square, lastOutcome, drawOffer };
    }
    return session;
  }

  if (
    isOwnMovablePiece(play.board, play.sideToMove, square, firstMoveRestricted)
  ) {
    return { play, selection: square, lastOutcome, drawOffer };
  }
  return session;
}

/**
 * Offers a draw (rules.md §5.6) on behalf of the current side to move,
 * recording it as the pending `drawOffer` and clearing any current
 * selection - the board goes inert the moment an offer is made. Does
 * **not** change `play.sideToMove`. A **no-op** if the game has already
 * ended or an offer is already pending.
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
 * **agreement** (`play.ts`'s `agreeDraw`), and clears the pending offer. A
 * **no-op** if no offer is pending.
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
 * offering player, who still has their turn. A **no-op** if no offer is
 * pending.
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

/**
 * Resigns on behalf of the current side to move (rules.md §5.5, this plan's
 * Decision 9): ends the game immediately as a win for the opponent
 * (`play.ts`'s `resign`), needing no acceptance and unable to be declined,
 * and clears any current selection. The board is inert afterward - not
 * because an offer is pending, but because the game is now over. A **no-op**
 * if the board is already inert (the game has already ended, or a draw
 * offer is awaiting an answer - the offer must be answered first).
 */
export function resign(session: PlaySession): PlaySession {
  if (isInert(session)) {
    return session;
  }
  return {
    play: declareResignation(session.play, session.play.sideToMove),
    selection: null,
    lastOutcome: session.lastOutcome,
    drawOffer: null,
  };
}

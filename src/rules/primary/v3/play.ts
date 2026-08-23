// Phase-2 play-state model & move application for ruleset major 3 (see
// `edition.ts` for its edition id), written from `reference/rules.md` §4.1
// (turn order - White's first-move restriction), §4.5 (recording a move) and
// §5 (ending the game, including its declared endings) alone (this story's
// implementation plan, Step 9) - major 2's own `play.ts` was read only for
// folder shape, per this plan's version-wall constraint, and is not built on:
// major 3 has no placement phase to start from (it starts from a *generated*
// position, `startPosition.ts`, Step 4), a different notation grammar
// (`notation.ts`, above), a different outcome shape with two more endings
// (`outcome.ts`, Step 8), and no `RuleConfiguration` to thread through, since
// major 3 has none.
//
// A `PlayState` is the top of this ruleset version - everything above the
// rules layer (a future session/announcement layer, out of scope for this
// step) talks to it and nothing else here. It tracks: the edition tag, the
// *starting* board and its position ID (kept alongside the current board so a
// future record writer can always reproduce the starting position, exactly as
// major 2's `PlayState.initialBoard` does), the current board, whose turn it
// is, every move made so far in order as extended-notation strings
// (`notation.ts`'s `renderMoveToken`, produced fresh at the moment each move
// is applied - see this plan's Decision 12, "the record text is already
// correct for whichever follow-up story surfaces it"), the single shared
// inactivity counter (rules.md §5.4), and the current `GameOutcome`
// (`outcome.ts`) - the result of resolving every move against §5's endings.
//
// Operations are pure and immutable-style: `applyMove` returns a *new* state
// rather than mutating its input, matching major 2's `play.ts` and every
// other module in this ruleset version. Because a caller (eventually the UI,
// through a session layer this story does not build - Step 13) only ever
// offers a legal destination or a legal attack target, `applyMove` treats
// anything else as a programming-invariant violation and throws, rather than
// silently no-op'ing - again matching major 2's precedent.
//
// Builds on the board geometry (`board.ts`, Step 1), the board-state model
// (`position.ts`, Step 2), the position ID and starting-position generator
// (`positionId.ts`/`startPosition.ts`, Steps 3-4), movement
// (`movement.ts`, Steps 5-6), combat (`combat.ts`, Step 7), game-end
// detection (`outcome.ts`, Step 8) and notation (`notation.ts`, above) - every
// earlier step in this folder.

import { otherSide, squareKey, type Side, type Square } from "./board.ts";
import { resolveCombat, type CombatResult } from "./combat.ts";
import { rulesetTag, type EditionId } from "./edition.ts";
import { renderMoveToken } from "./notation.ts";
import { computeOutcome, type GameOutcome } from "./outcome.ts";
import { legalAttacks, legalDestinations } from "./movement.ts";
import {
  pieceAt,
  relocatePiece,
  type PlacedPiece,
  type PositionState,
} from "./position.ts";
import type { PositionId } from "./positionId.ts";
import type { GeneratedStartPosition } from "./startPosition.ts";

/** The side that moves first, per rules.md §4.1 ("White's first move of the game is limited to one square"). */
const FIRST_SIDE: Side = "white";

/**
 * An in-progress (or finished) major-3 game: the edition tag (always
 * `rulesetTag()`'s value - see `edition.ts` - since major 3 has exactly one
 * edition), the *starting* board and the position ID that names White's half
 * of it (`startPosition.ts`'s `GeneratedStartPosition`), the *current* board,
 * whose turn it is, every move made so far in order as extended-notation
 * strings (`notation.ts`), the single shared inactivity counter (rules.md
 * §5.4), and the current `GameOutcome` (`outcome.ts`) - whether the game is
 * still ongoing, or how (and for whom) it ended. Everything downstream reads
 * `result` rather than recomputing detection for itself.
 */
export interface PlayState {
  readonly ruleset: EditionId;
  readonly startingBoard: PositionState;
  readonly startingPositionId: PositionId;
  readonly board: PositionState;
  readonly sideToMove: Side;
  readonly moves: readonly string[];
  readonly inactivityCounter: number;
  readonly result: GameOutcome;
}

/**
 * The opening `PlayState` for a freshly generated starting position
 * (`startPosition.ts`'s `generateStartPosition`): the generated board as both
 * the starting and current board, White (Red) to move first (rules.md
 * §4.1), no moves made yet, the inactivity counter starting at 0 (rules.md
 * §5.4), and `result` computed immediately (always `{ kind: "ongoing" }` for
 * a freshly generated position, since both Flags and every numbered piece are
 * present - kept as a real call to `computeOutcome` rather than a hard-coded
 * value so this stays correct if that ever stops being true).
 */
export function startPlay(generated: GeneratedStartPosition): PlayState {
  const inactivityCounter = 0;
  return {
    ruleset: rulesetTag(),
    startingBoard: generated.position,
    startingPositionId: generated.positionId,
    board: generated.position,
    sideToMove: FIRST_SIDE,
    moves: [],
    inactivityCounter,
    result: computeOutcome(generated.position, FIRST_SIDE, inactivityCounter),
  };
}

/**
 * The outcome of a single ply applied via `applyMove`: either a resolved
 * combat encounter (`kind: "attack"`, carrying `resolveCombat`'s full
 * `CombatResult` - combat.ts, including the ordinary/Flag-capture
 * distinction and the survivor's new rank) or, for a plain move onto an empty
 * square, a "just a move" record (`kind: "move"`) naming the piece that moved
 * and the square it moved to. A future announcement layer (Step 13)
 * discriminates on `kind` to decide what to say.
 */
export type PlyOutcome =
  | {
      readonly kind: "move";
      readonly piece: PlacedPiece;
      readonly square: Square;
    }
  | { readonly kind: "attack"; readonly combat: CombatResult };

/**
 * True iff `state` has not yet had a move applied to it - the one moment
 * rules.md §4.1's first-move restriction bites, since White always moves
 * first (`FIRST_SIDE`) and the restriction is "White's first move of the
 * game", not White generally. Every later White move, and every Black move,
 * follows the ordinary rules.
 */
function isFirstMoveOfGame(state: PlayState): boolean {
  return state.moves.length === 0;
}

/**
 * Applies a single ply - a plain move or an attack - moving the piece on
 * `from` to `to`, and returns a *new* `PlayState` (the input is never
 * mutated) together with the resolved `PlyOutcome`.
 *
 * If `to` is among `legalDestinations(state.board, from, ...)` this is a
 * plain move: the piece relocates and the outcome is `{ kind: "move", ... }`.
 * If `to` is instead among `legalAttacks(state.board, from, ...)` this is an
 * attack: it is resolved via `resolveCombat` (combat.ts) and the board
 * becomes exactly the position that function already computed - including
 * the survivor's demotion, or the Flag's removal on capture - and the
 * outcome is `{ kind: "attack", combat }`. Both legality checks are made with
 * `firstMoveRestricted` set exactly when this is White's first move of the
 * game (`isFirstMoveOfGame`), so a two-square opening move is rejected the
 * same way an illegal target is.
 *
 * In every case the side to move flips and the move is appended to
 * `state.moves` in extended notation (`renderMoveToken`, notation.ts,
 * `null` for a plain move's `combat` argument, the resolved `CombatResult`
 * for an attack) - so the stored move always carries the outcome, never just
 * the source and destination. The shared inactivity counter (rules.md §5.4)
 * rises by 1 when the ply removed no piece (a plain move) and resets to 0 the
 * moment any piece is removed (every attack removes at least one piece - the
 * attacker, the defender, the Flag, or more than one of them - rules.md
 * §5.4's "a move that merely reduces a piece's rank without removing anything
 * cannot occur").
 *
 * After the counter is updated, `state.result` is recomputed
 * (`computeOutcome`, outcome.ts) from the *new* board, the *new* side to
 * move, and the updated counter, so the returned state always reflects
 * whether that ply just ended the game - and, if so, who won (or that it is
 * a draw) and why. Checked after *every* move, per rules.md §5.
 *
 * Rejects (throws) if `state.result` is already a finished game, if `from`
 * does not hold a piece belonging to `state.sideToMove`, or if `to` is
 * neither a legal destination nor a legal attack target for that piece - a
 * caller only ever offers such a move, so each of these is a
 * programming-invariant guard, not a user-facing error.
 */
export function applyMove(
  state: PlayState,
  from: Square,
  to: Square,
): { readonly state: PlayState; readonly outcome: PlyOutcome } {
  if (state.result.kind !== "ongoing") {
    throw new Error("play.ts: applyMove: the game has already ended.");
  }

  const fromKey = squareKey(from);
  const toKey = squareKey(to);
  const piece = pieceAt(state.board, from);
  if (piece === undefined || piece.side !== state.sideToMove) {
    throw new Error(
      `play.ts: applyMove: ${fromKey} does not hold a piece belonging to ${state.sideToMove}.`,
    );
  }

  const firstMoveRestricted = isFirstMoveOfGame(state);
  const isAttack = legalAttacks(state.board, from, firstMoveRestricted).some(
    (square) => squareKey(square) === toKey,
  );
  const isMove =
    !isAttack &&
    legalDestinations(state.board, from, firstMoveRestricted).some(
      (square) => squareKey(square) === toKey,
    );
  if (!isAttack && !isMove) {
    throw new Error(
      `play.ts: applyMove: ${toKey} is not a legal destination or attack target for the piece on ${fromKey}.`,
    );
  }

  let board: PositionState;
  let outcome: PlyOutcome;
  let combatForNotation: CombatResult | null;

  if (isAttack) {
    const combat = resolveCombat(state.board, from, to);
    board = combat.position;
    outcome = { kind: "attack", combat };
    combatForNotation = combat;
  } else {
    board = relocatePiece(state.board, from, to);
    outcome = { kind: "move", piece, square: to };
    combatForNotation = null;
  }

  // The single shared inactivity counter (rules.md §5.4): a plain move never
  // removes a piece, so it always raises the counter; an attack always
  // removes at least one piece - the attacker, the defender, or the Flag on
  // capture - so it always resets the counter to 0.
  const removedAPiece = outcome.kind === "attack";
  const inactivityCounter = removedAPiece ? 0 : state.inactivityCounter + 1;

  const nextSideToMove = otherSide(state.sideToMove);

  return {
    state: {
      ...state,
      board,
      sideToMove: nextSideToMove,
      moves: [...state.moves, renderMoveToken(from, to, combatForNotation)],
      inactivityCounter,
      result: computeOutcome(board, nextSideToMove, inactivityCounter),
    },
    outcome,
  };
}

/**
 * Ends `state`'s game immediately as a **resignation** (rules.md §5.5): the
 * opponent of `resigningSide` wins, with no acceptance needed, no position
 * preventing it, and no move appended - a resignation is a declaration, not a
 * ply. Returns a new state whose `result` is `{ kind: "win", winner:
 * otherSide(resigningSide), reason: "resignation" }` and is otherwise
 * **unchanged** - no counter update, no side-to-move flip, no move recorded.
 *
 * Available to either side, at any point in an ongoing game (rules.md §5.5:
 * "it is always available - no position prevents a player from resigning"),
 * including before either side has made a move. Rejects (throws) if the game
 * has already ended - a programming-invariant guard, like `applyMove`'s.
 */
export function resign(state: PlayState, resigningSide: Side): PlayState {
  if (state.result.kind !== "ongoing") {
    throw new Error("play.ts: resign: the game has already ended.");
  }
  return {
    ...state,
    result: {
      kind: "win",
      winner: otherSide(resigningSide),
      reason: "resignation",
    },
  };
}

/**
 * Ends `state`'s game immediately as a draw by **agreement** (rules.md §5.6)
 * - the other declared ending: `computeOutcome` never produces the
 * `"agreement"` reason itself. Returns a new state whose `result` is `{ kind:
 * "draw", reason: "agreement" }` and is otherwise **unchanged** - no counter
 * update, no side-to-move flip, no move appended to `state.moves`, since an
 * offer never replaces or skips a move and an agreed draw leaves no trace in
 * the move sequence. The draw offer/accept/decline *interaction* (who
 * offered, whether an answer is pending) is session state, not rule state -
 * out of scope for this step (Step 13) - this function only performs the
 * ending itself, once a session layer has decided to call it.
 *
 * Rejects (throws) if the game has already ended - a programming-invariant
 * guard, like `applyMove`'s: a caller only ever offers a draw while the game
 * is ongoing.
 */
export function agreeDraw(state: PlayState): PlayState {
  if (state.result.kind !== "ongoing") {
    throw new Error("play.ts: agreeDraw: the game has already ended.");
  }
  return {
    ...state,
    result: { kind: "draw", reason: "agreement" },
  };
}

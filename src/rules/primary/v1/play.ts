// Phase 2 play-state model & move application for ruleset 1.2.
//
// A `PlayState` tracks an in-progress Phase-2 game: the current board, whose
// turn it is to move, and the ordered list of moves made so far in the
// simple `A2A3` coordinate form (source square immediately followed by
// destination square, no separator - rules.md §4.4, unchanged for attacks:
// no combat-resolution markers). This is the minimum structure recorded-game
// replay can build on later; this story does not implement replay itself.
//
// Operations are pure and immutable-style - `applyMove` returns a *new*
// state rather than mutating its input - matching placement.ts. Because the
// UI only ever offers a legal destination or a legal attack target
// (structural prevention), `applyMove` treats anything else as a
// programming-invariant violation: it throws rather than silently
// no-op'ing.
//
// A destination among `legalDestinations` (movement.ts) is a plain move: the
// piece relocates. A destination among `legalAttacks` (movement.ts, story
// 00000005 Step 3) is an attack: it is resolved via `resolveCombat`
// (combat.ts, story 00000005 Steps 1-2) and the board updates per the
// outcome (attacker wins / attacker loses / mutual loss). The two
// destination sets are always disjoint - an enemy-occupied square is never a
// `legalDestinations` result - so there is never ambiguity about which
// applies. `applyMove` exposes the resolved `PlyOutcome` alongside the new
// state so callers (the session layer, story 00000006's game-end detection)
// can react to what the ply actually did without re-deriving it.
//
// This module builds on the board geometry (board.ts), the movement and
// attack-target rules (movement.ts, stories 00000004/00000005), the combat
// resolution rules (combat.ts, story 00000005), and the initial-game-state
// artifact (gameState.ts, story 00000001); it has no further dependencies.

import { otherSide, squareKey, type Side, type Square } from "./board.ts";
import { resolveCombat, type CombatOutcome } from "./combat.ts";
import {
  renderPositionBlock,
  type BoardState,
  type InitialGameState,
  type PlacedPiece,
} from "./gameState.ts";
import { legalAttacks, legalDestinations } from "./movement.ts";
import {
  computeOutcome,
  type GameEndReason,
  type GameOutcome,
} from "./outcome.ts";

/** The side that moves first, per rules.md §4.1 (White/Red moves first). */
const FIRST_SIDE: Side = "white";

/**
 * An in-progress Phase-2 game: the ruleset it was played under, the
 * *starting* board (the revealed position play began from - kept alongside
 * the current board so the record render, below, can always reproduce the
 * record file format's position block, which is always the *starting*
 * position, never the current one), the current board, whose turn it is,
 * every move made so far, in order, as `A2A3` coordinate strings (absolute
 * White frame - see board.ts), the single shared inactivity counter (§5.3 -
 * see `applyMove` for how it evolves), and the current `GameOutcome`
 * (`result` - outcome.ts): whether the game is still ongoing, or how it
 * ended. Everything downstream (the session layer, the UI, the record) reads
 * `result` rather than recomputing detection for itself.
 */
export interface PlayState {
  readonly ruleset: string;
  readonly initialBoard: BoardState;
  readonly board: BoardState;
  readonly sideToMove: Side;
  readonly moves: readonly string[];
  readonly inactivityCounter: number;
  readonly result: GameOutcome;
}

/**
 * The opening `PlayState` for `initial` (the completed-placement artifact):
 * the same board (as both the starting and current board), White (Red) to
 * move first, no moves made yet, the ruleset carried over unchanged, the
 * shared inactivity counter starting at 0 (rules.md §5.3), and `result`
 * computed immediately (always `{ kind: "ongoing" }` at the reveal, since
 * both Flags are always present and both sides always have a legal ply from
 * a freshly completed placement - kept as a real call to `computeOutcome`
 * rather than a hard-coded value so this stays correct if that ever stops
 * being true).
 */
export function startPlay(initial: InitialGameState): PlayState {
  const inactivityCounter = 0;
  return {
    ruleset: initial.ruleset,
    initialBoard: initial.board,
    board: initial.board,
    sideToMove: FIRST_SIDE,
    moves: [],
    inactivityCounter,
    result: computeOutcome(initial.board, FIRST_SIDE, inactivityCounter),
  };
}

/**
 * The outcome of a single ply applied via `applyMove`: either a resolved
 * combat encounter (`kind: "attack"`, carrying every field of
 * `resolveCombat`'s `CombatOutcome` - combat.ts) or, for a plain move onto an
 * empty square, a "just a move" record (`kind: "move"`) naming the piece
 * that moved and the square it moved to - deliberately with no
 * attacker/defender/capture to report, since nothing fought. Callers (the
 * session layer, and the game-end detection above) discriminate on `kind`.
 */
export type PlyOutcome =
  | ({ readonly kind: "attack" } & CombatOutcome)
  | {
      readonly kind: "move";
      readonly piece: PlacedPiece;
      readonly square: Square;
    };

/**
 * Applies a single ply - a plain move or an attack - moving the piece on
 * `from` to `to`, and returns a *new* `PlayState` (the input is never
 * mutated) together with the resolved `PlyOutcome`.
 *
 * If `to` is among `legalDestinations(state.board, from)` this is a plain
 * move: the piece relocates and the outcome is `{ kind: "move", ... }`. If
 * `to` is instead among `legalAttacks(state.board, from)` this is an attack:
 * it is resolved via `resolveCombat` and the board updates per the result -
 * **attacker wins** removes the defender and moves the attacker onto `to`;
 * **attacker loses** removes the attacker and leaves the defender in place;
 * **mutual loss** removes both, leaving `to` empty - and the outcome is
 * `{ kind: "attack", ...combatOutcome }`.
 *
 * In every case the side to move flips and the move is appended to
 * `state.moves` in the same plain `A2A3` coordinate string
 * (`squareKey(from) + squareKey(to)`) - no combat-resolution markers, even
 * for an attack. The shared inactivity counter (rules.md §5.3) rises by 1
 * when the ply removed no piece (`outcome.kind === "move"`, or an attack
 * whose `capture` is `false`) and resets to 0 the moment any piece is
 * removed (a winning attack, a mutual loss, or - once Towers exist - a
 * Tower trade: exactly when `outcome.capture` is `true`).
 *
 * After the counter is updated, `state.result` is recomputed
 * (`computeOutcome`, outcome.ts) from the *new* board, the *new* side to
 * move, and the updated counter, so the returned state always reflects
 * whether that ply just ended the game - and, if so, who won (or that it is
 * a draw) and why.
 *
 * Rejects (throws) if `state.result` is already a finished game, if `from`
 * does not hold a piece belonging to `state.sideToMove`, or if `to` is
 * neither a legal destination nor a legal attack target for that piece - the
 * UI never offers such a move (it makes the board inert the moment the game
 * ends - Step 6), so each of these is a programming-invariant guard, not a
 * user-facing error.
 */
export function applyMove(
  state: PlayState,
  from: Square,
  to: Square,
): { readonly state: PlayState; readonly outcome: PlyOutcome } {
  if (state.result.kind !== "ongoing") {
    throw new Error("Cannot apply move: the game has already ended.");
  }

  const fromKey = squareKey(from);
  const toKey = squareKey(to);
  const piece = state.board[fromKey];
  if (piece === undefined || piece.side !== state.sideToMove) {
    throw new Error(
      `Cannot apply move: ${fromKey} does not hold a piece belonging to ${state.sideToMove}.`,
    );
  }

  const isAttack = legalAttacks(state.board, from).some(
    (square) => squareKey(square) === toKey,
  );
  const isMove =
    !isAttack &&
    legalDestinations(state.board, from).some(
      (square) => squareKey(square) === toKey,
    );
  if (!isAttack && !isMove) {
    throw new Error(
      `Cannot apply move: ${toKey} is not a legal destination or attack target for the piece on ${fromKey}.`,
    );
  }

  const board: Record<string, PlacedPiece> = { ...state.board };
  let outcome: PlyOutcome;

  if (isAttack) {
    const combat = resolveCombat(state.board, from, to);
    delete board[fromKey];
    delete board[toKey];
    if (combat.result === "attackerWins") {
      board[toKey] = piece;
    } else if (combat.result === "attackerLoses") {
      board[toKey] = combat.defender;
    }
    // mutualLoss: both squares stay empty - already deleted above.
    outcome = { kind: "attack", ...combat };
  } else {
    delete board[fromKey];
    board[toKey] = piece;
    outcome = { kind: "move", piece, square: to };
  }

  // The single shared inactivity counter (rules.md §5.3): a plain move never
  // removes a piece, so it always raises the counter; an attack always
  // removes at least one piece - the attacker, the defender, or both - so it
  // always resets the counter to 0 (including a complete sacrifice, where
  // only the attacker falls, and a Tower trade, which is always a
  // `mutualLoss`).
  const removedAPiece = outcome.kind === "attack";
  const inactivityCounter = removedAPiece ? 0 : state.inactivityCounter + 1;

  const nextSideToMove = otherSide(state.sideToMove);

  return {
    state: {
      ...state,
      board,
      sideToMove: nextSideToMove,
      moves: [...state.moves, fromKey + toKey],
      inactivityCounter,
      result: computeOutcome(board, nextSideToMove, inactivityCounter),
    },
    outcome,
  };
}

/**
 * Ends `state`'s game immediately as a draw by **agreement** (rules.md §5) -
 * the one ending that is *declared*, not detected: `computeOutcome` never
 * produces the `"agreement"` reason. Returns a new state whose `result` is
 * `{ kind: "draw", reason: "agreement" }` and is otherwise **unchanged** - no
 * counter update, no side-to-move flip, no move appended to `state.moves` -
 * since an offer never replaces or skips a move and an agreed draw leaves no
 * trace in the move sequence (see the record layer, below). The draw
 * offer/accept/decline *interaction* (who offered, whether an answer is
 * pending) is session state, not rule state - see
 * `src/board/playSession.ts` - this function only performs the ending
 * itself, once the session layer has decided to call it.
 *
 * Rejects (throws) if the game has already ended - a programming-invariant
 * guard, like `applyMove`'s: the UI never offers a draw once the game is
 * over.
 */
export function agreeDraw(state: PlayState): PlayState {
  if (state.result.kind !== "ongoing") {
    throw new Error("Cannot agree to a draw: the game has already ended.");
  }
  return {
    ...state,
    result: { kind: "draw", reason: "agreement" },
  };
}

/**
 * Maps a finished game's winner (`Side`, or `undefined` for a draw) to the
 * record file format's PGN `Result` value: `1-0` for White (Red), `0-1` for
 * Black (Blue), `1/2-1/2` for a draw. Note the record uses White/Black, not
 * the UI's Red/Blue.
 */
function renderResultValue(winner: Side | undefined): string {
  if (winner === "white") {
    return "1-0";
  }
  if (winner === "black") {
    return "0-1";
  }
  return "1/2-1/2";
}

/**
 * Maps a `GameEndReason` (outcome.ts's stable identifier) to the record file
 * format's `ResultReason` free text. `"Agreement"` is not from the rules
 * text - it is the owner's fixed choice (2026-07-11, carried over from
 * ruleset 1.1) for a draw by agreement, to be raised upstream so both
 * codebases agree.
 */
function renderResultReasonValue(reason: GameEndReason): string {
  switch (reason) {
    case "flagCapture":
      return "Flag Captured";
    case "noLegalMove":
      return "No Legal Move";
    case "inactivity":
      return "Inactivity";
    case "agreement":
      return "Agreement";
  }
}

/**
 * Renders `state` as an inspectable, developer-facing text form that
 * anticipates the companion repository's recorded-game replay file format
 * (`doc/ruleset/technical-notes.md`, "Record file format") without
 * implementing replay itself. It carries the load-bearing pieces of that
 * format:
 *
 * - the **`Result`** header tag, always written, in the record format's PGN
 *   values: `1-0` when White (Red) has won, `0-1` when Black (Blue) has won,
 *   `1/2-1/2` for a draw, `*` while the game is still ongoing;
 * - the **`ResultReason`** header tag, free text describing *why* the game
 *   ended (see `renderResultReasonValue`) - written **only once the game has
 *   ended**; while `state.result.kind === "ongoing"` this tag is **omitted
 *   entirely** (owner's decision, 2026-07-11), so an ongoing record carries
 *   `[Result "*"]` and no `ResultReason` tag at all;
 * - the `Ruleset` header tag, in the same `[Name "value"]` syntax the record
 *   file format uses for header tags;
 * - the **position block** for the *starting* position play began from
 *   (`state.initialBoard`, via `renderPositionBlock` - not the current
 *   board, which evolves as moves are applied);
 * - the **move sequence**, grouped into rounds numbered from 1, each written
 *   `N. <whiteMove> <blackMove>` (a game whose last move was White's shows
 *   that trailing round with only the White move) - in the plain `A2A3`
 *   form, with no separators and no combat-resolution markers even for an
 *   attack (rules.md §4.4 - an attack's result always follows automatically
 *   from the position and the rules), and with **no** entry of any kind for
 *   a draw offer, decline, or agreement (an agreed draw appears only in the
 *   `Result`/`ResultReason` tags above).
 *
 * This is deliberately not a full record file (no `Event`/`Site`/`Date`/etc.
 * roster tags): it is the minimum a future replay story can build on, kept
 * as a plain string.
 */
export function renderGameRecord(state: PlayState): string {
  const positionBlock = renderPositionBlock({
    ruleset: state.ruleset,
    board: state.initialBoard,
  });

  const rounds: string[] = [];
  for (let i = 0; i < state.moves.length; i += 2) {
    const roundNumber = i / 2 + 1;
    const whiteMove = state.moves[i];
    const blackMove = state.moves[i + 1];
    rounds.push(
      blackMove === undefined
        ? `${roundNumber}. ${whiteMove}`
        : `${roundNumber}. ${whiteMove} ${blackMove}`,
    );
  }

  const headerTags: string[] = [];
  if (state.result.kind === "ongoing") {
    headerTags.push('[Result "*"]');
  } else {
    const winner =
      state.result.kind === "win" ? state.result.winner : undefined;
    headerTags.push(`[Result "${renderResultValue(winner)}"]`);
    headerTags.push(
      `[ResultReason "${renderResultReasonValue(state.result.reason)}"]`,
    );
  }
  headerTags.push(`[Ruleset "${state.ruleset}"]`);

  const sections = [headerTags.join("\n"), positionBlock];
  // Omit the move-sequence section entirely before any move is made, so the
  // record doesn't end with a trailing empty section.
  if (rounds.length > 0) {
    sections.push(rounds.join("\n"));
  }
  return sections.join("\n\n");
}

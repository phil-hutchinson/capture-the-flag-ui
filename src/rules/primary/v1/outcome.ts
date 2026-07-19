// Game-end detection for ruleset PRIMARY:1.1, §6 (companion capture-the-flag
// repository, `doc/ruleset/rules.md`, the single source of truth).
//
// The game ends the moment any §6 condition is met (§6 preamble). This
// module decides, from a snapshot of the current board and rule state,
// whether the game has ended and - if so - who won (or that it is a draw)
// and why, following the *precedence* the companion repository's reference
// engine (`capture_the_flag/outcome.py`) uses, recorded verbatim in this
// story's implementation-plan.md "Evaluation precedence" so recorded games
// replay identically in both codebases:
//
//   1. §6.1 Flag capture.
//   2. §6.2 Unbreachable Flag (both sides at once -> draw).
//   3. The opponent's inactivity loss (§6.4) - attributable to the
//      opponent's just-completed ply.
//   4. The shared no-progress draw (§6.5) - also attributable to the
//      opponent's just-completed ply.
//   5. §6.3 No legal move.
//   6. The active side's own inactivity counter at the limit (unreachable in
//      normal play - implemented for completeness).
//
// `computeOutcome` takes **plain parameters** - the board, the side to move,
// both inactivity counters, and the progress counter - never a `PlayState`,
// so this module never imports `play.ts` (which imports this one, to wire
// the result into the play state - story 00000006 Step 4).
//
// This module is pure rule logic - no React - and builds only on the board
// geometry (board.ts), `BoardState` (gameState.ts), the no-legal-ply
// primitive (movement.ts), and the Unbreachable Flag inputs (reachability.ts,
// Step 1); it has no further dependencies.

import { allSquares, otherSide, squareKey, type Side } from "./board.ts";
import type { BoardState } from "./gameState.ts";
import { hasAnyLegalPly } from "./movement.ts";
import { computeUnbreachableFlagInputs } from "./reachability.ts";

/** The per-side inactivity counter limit at which that side loses immediately (§6.4). */
export const INACTIVITY_LIMIT = 50;

/** The shared progress counter limit at which the game is a draw (§6.5). */
export const PROGRESS_LIMIT = 80;

/**
 * The six ways a game of Capture the Flag can end, per rules.md §6, as
 * stable identifiers - not player-facing text and not the record file
 * format's `ResultReason` strings. Later steps map these to player-facing
 * sentences (Steps 7/9) and to the record layer's strings (Step 5); this
 * module's callers must not have to parse a sentence to know why the game
 * ended.
 */
export type GameEndReason =
  | "flagCapture"
  | "unbreachableFlag"
  | "noLegalMove"
  | "inactivity"
  | "noProgress"
  | "agreement";

/**
 * Whether - and how - a game has ended: still `"ongoing"`, a `"win"` for one
 * `Side` (with the reason), or a `"draw"` (with the reason). `computeOutcome`
 * below never produces the `"agreement"` reason - a draw by agreement is a
 * declared state transition, not a detected condition (see `play.ts`'s
 * `agreeDraw`, Step 4) - but it is part of this union so every module that
 * consumes a finished `GameOutcome` (the record layer, the UI) has one type
 * to handle regardless of how the game ended.
 */
export type GameOutcome =
  | { readonly kind: "ongoing" }
  | {
      readonly kind: "win";
      readonly winner: Side;
      readonly reason: GameEndReason;
    }
  | { readonly kind: "draw"; readonly reason: GameEndReason };

/** True iff `side` still has its Flag somewhere on `board` (not yet captured). */
function hasFlag(board: BoardState, side: Side): boolean {
  return allSquares().some((square) => {
    const occupant = board[squareKey(square)];
    return (
      occupant !== undefined &&
      occupant.side === side &&
      occupant.pieceType === "flag"
    );
  });
}

/**
 * Decides whether - and how - the game has ended, given `board`, the
 * `activeSide` (whose turn it now is), both sides' inactivity counters, and
 * the shared progress counter. Evaluates the precedence documented at the
 * top of this module, exactly in that order, and returns the first
 * condition that applies - or `{ kind: "ongoing" }` if none does.
 *
 * Called once at the start of Phase 2 (`startPlay`, since §6.2 can already
 * hold from placement alone, before any ply) and again after every applied
 * ply (`applyMove`), always with the counters and board already reflecting
 * that ply and `activeSide` already the *new* side to move.
 */
export function computeOutcome(
  board: BoardState,
  activeSide: Side,
  inactivityCounters: Readonly<Record<Side, number>>,
  progressCounter: number,
): GameOutcome {
  const opponent = otherSide(activeSide);

  // 1. §6.1 Flag capture - "does this side still have a Flag on the board",
  // not a check of what the last ply did.
  if (!hasFlag(board, activeSide)) {
    return { kind: "win", winner: opponent, reason: "flagCapture" };
  }
  if (!hasFlag(board, opponent)) {
    return { kind: "win", winner: activeSide, reason: "flagCapture" };
  }

  // 2. §6.2 Unbreachable Flag - compute both sides' conditions; both at once
  // is a draw, otherwise the side whose condition holds wins.
  const inputs = computeUnbreachableFlagInputs(board);
  const whiteWinsUnbreachable =
    inputs.whiteFlagEnclosed && !inputs.blackSappersAvailable;
  const blackWinsUnbreachable =
    inputs.blackFlagEnclosed && !inputs.whiteSappersAvailable;
  if (whiteWinsUnbreachable && blackWinsUnbreachable) {
    return { kind: "draw", reason: "unbreachableFlag" };
  }
  if (whiteWinsUnbreachable) {
    return { kind: "win", winner: "white", reason: "unbreachableFlag" };
  }
  if (blackWinsUnbreachable) {
    return { kind: "win", winner: "black", reason: "unbreachableFlag" };
  }

  // 3. The opponent's inactivity loss (§6.4) - attributable to the
  // opponent's just-completed ply, so it precedes the active side's own
  // no-legal-move check (5) below.
  if (inactivityCounters[opponent] >= INACTIVITY_LIMIT) {
    return { kind: "win", winner: activeSide, reason: "inactivity" };
  }

  // 4. The shared no-progress draw (§6.5) - also attributable to the
  // opponent's just-completed ply, so it too precedes (5).
  if (progressCounter >= PROGRESS_LIMIT) {
    return { kind: "draw", reason: "noProgress" };
  }

  // 5. §6.3 No legal move - the active side has no legal ply at all.
  if (!hasAnyLegalPly(board, activeSide)) {
    return { kind: "win", winner: opponent, reason: "noLegalMove" };
  }

  // 6. The active side's own inactivity counter at the limit - unreachable
  // in normal play (that counter only advances on the active side's own
  // plies, and would have ended the game at the close of their previous
  // turn via case 3 above, from the opponent's perspective); implemented
  // anyway, for completeness.
  if (inactivityCounters[activeSide] >= INACTIVITY_LIMIT) {
    return { kind: "win", winner: opponent, reason: "inactivity" };
  }

  return { kind: "ongoing" };
}

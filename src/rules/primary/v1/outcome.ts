// Game-end detection for ruleset 1.2, §5 (companion capture-the-flag
// repository, `doc/ruleset/rules.md`, the single source of truth).
//
// The game ends the moment any §5 condition is met. This module decides,
// from a snapshot of the current board, the side to move, and the single
// shared inactivity counter, whether the game has ended and - if so - who
// won (or that it is a draw) and why, evaluated in the precedence documented
// on `computeOutcome` below.
//
// `computeOutcome` takes **plain parameters** - the board, the side to move,
// and the shared inactivity counter - never a `PlayState`, so this module
// never imports `play.ts` (which imports this one, to wire the result into
// the play state).
//
// This module is pure rule logic - no React - and builds only on the board
// geometry (board.ts), `BoardState` (gameState.ts), and the no-legal-ply
// primitive (movement.ts); it has no further dependencies. The structural
// reachability machinery (`reachability.ts`) that served the 1.1
// Unbreachable Flag win no longer exists - 1.2 has no such condition.

import { allSquares, otherSide, squareKey, type Side } from "./board.ts";
import type { BoardState } from "./gameState.ts";
import { hasAnyLegalPly } from "./movement.ts";

/**
 * The number of consecutive moves that remove no piece it takes for the
 * shared inactivity counter to end the game as a draw (rules.md §5).
 */
export const INACTIVITY_LIMIT = 50;

/**
 * The four ways a game of Capture the Flag can end, per rules.md §5, as
 * stable identifiers - not player-facing text and not the record file
 * format's `ResultReason` strings. `playAnnouncement.ts` maps these to
 * player-facing sentences and the record layer (`play.ts`) maps them to the
 * record file format's strings; this module's callers must not have to
 * parse a sentence to know why the game ended.
 */
export type GameEndReason =
  | "flagCapture"
  | "noLegalMove"
  | "inactivity"
  | "agreement";

/**
 * Whether - and how - a game has ended: still `"ongoing"`, a `"win"` for one
 * `Side` (with the reason), or a `"draw"` (with the reason). `computeOutcome`
 * below never produces the `"agreement"` reason - a draw by agreement is a
 * declared state transition, not a detected condition (see `play.ts`'s
 * `agreeDraw`) - but it is part of this union so every module that consumes
 * a finished `GameOutcome` (the record layer, the UI) has one type to handle
 * regardless of how the game ended.
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
 * `activeSide` (whose turn it now is), and the single shared
 * `inactivityCounter`. Evaluates, in order:
 *
 * 1. **Flag capture (§5.1)** - the side missing its Flag loses.
 * 2. **No legal move (§5.2)** - the active side has no legal ply at all, and
 *    loses.
 * 3. **Inactivity (§5.3)** - the shared counter has reached
 *    `INACTIVITY_LIMIT` - the game is a draw.
 *
 * Returns `{ kind: "ongoing" }` if none of the above applies.
 *
 * Called once at the start of Phase 2 (`startPlay`) and again after every
 * applied ply (`applyMove`), always with the counter and board already
 * reflecting that ply and `activeSide` already the *new* side to move.
 */
export function computeOutcome(
  board: BoardState,
  activeSide: Side,
  inactivityCounter: number,
): GameOutcome {
  const opponent = otherSide(activeSide);

  // 1. §5.1 Flag capture - "does this side still have a Flag on the board",
  // not a check of what the last ply did.
  if (!hasFlag(board, activeSide)) {
    return { kind: "win", winner: opponent, reason: "flagCapture" };
  }
  if (!hasFlag(board, opponent)) {
    return { kind: "win", winner: activeSide, reason: "flagCapture" };
  }

  // 2. §5.2 No legal move - the active side has no legal ply at all.
  if (!hasAnyLegalPly(board, activeSide)) {
    return { kind: "win", winner: opponent, reason: "noLegalMove" };
  }

  // 3. §5.3 The shared inactivity counter at the limit - a draw.
  if (inactivityCounter >= INACTIVITY_LIMIT) {
    return { kind: "draw", reason: "inactivity" };
  }

  return { kind: "ongoing" };
}

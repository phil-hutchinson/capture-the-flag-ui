// Game-end detection for ruleset major 3 (see `edition.ts` for its edition
// id), written from `reference/rules.md` §5 (Ending the Game) and its
// Glossary entries for "Attrition" and "Resignation" alone (this story's
// implementation plan, Step 8) - major 2's own `outcome.ts` was read only for
// folder shape, per this plan's version-wall constraint, and is not built on.
//
// §5 splits the six ways a game ends into two groups, in its own words:
// "Sections 5.1-5.4 are settled by the position itself. Sections 5.5 and 5.6
// are declared by a player and cannot be read off the board." This module
// (`computeOutcome`) detects the first four - Flag capture, attrition, mutual
// attrition, inactivity - from a board, the side now to move, and the shared
// inactivity counter. Resignation and agreement are never detected here: a
// later step (`play.ts`) declares them directly as state transitions. Both
// still belong to `GameOutcome`'s reason union so every consumer - the play
// state, the announcement layer, the UI - has one type to handle regardless
// of how the game ended.
//
// Unlike major 2, there is **no "no legal move" ending here**. §5.2 replaces
// it with attrition, checked after *every* move (including the opponent's)
// rather than only at the start of a turn - this module computes no legal
// moves at all, and has no dependency on `movement.ts`.
//
// Builds only on the board geometry (`board.ts`) and the board-state model
// (`position.ts`), both earlier steps; it has no further dependencies.

import { otherSide, type Side } from "./board.ts";
import {
  findFlag,
  numberedPieceCount,
  type PositionState,
} from "./position.ts";

/**
 * The number of consecutive moves that remove no piece it takes for the
 * shared inactivity counter to end the game as a draw (rules.md §5.4).
 * **Forty, not major 2's fifty** (`v2/outcome.ts`'s `INACTIVITY_LIMIT`) - the
 * two limits belong to different rules texts and must never be shared or
 * derived from one another.
 */
export const INACTIVITY_LIMIT = 40;

/**
 * Why a game ended, as a stable identifier - not player-facing text and not a
 * record-file string (major 3 writes no record files; see this story's
 * out-of-scope list). `flagCapture`, `attrition`, `mutualAttrition` and
 * `inactivity` are detected by `computeOutcome` below; `resignation` and
 * `agreement` are declared by a player (`play.ts`, Step 9) and never produced
 * here, but belong to this union so every consumer of a finished
 * `GameOutcome` has one type to handle.
 */
export type GameEndReason =
  | "flagCapture"
  | "attrition"
  | "mutualAttrition"
  | "inactivity"
  | "resignation"
  | "agreement";

/**
 * Whether - and how - a game has ended: still `"ongoing"`, a `"win"` for one
 * `Side` (with the reason), or a `"draw"` (with the reason).
 */
export type GameOutcome =
  | { readonly kind: "ongoing" }
  | {
      readonly kind: "win";
      readonly winner: Side;
      readonly reason: GameEndReason;
    }
  | { readonly kind: "draw"; readonly reason: GameEndReason };

/** True iff `side` still has its Flag somewhere on `position` (not yet captured). */
function hasFlag(position: PositionState, side: Side): boolean {
  return findFlag(position, side) !== undefined;
}

/** True iff `side` has no numbered pieces left on `position` - the Flag never counts (rules.md §5.2). */
function isInAttrition(position: PositionState, side: Side): boolean {
  return numberedPieceCount(position, side) === 0;
}

/**
 * Decides whether - and how - the game has ended, given `position`, the
 * `activeSide` (whose turn it now is), and the single shared
 * `inactivityCounter`. Called after **every** move, including the opponent's
 * (rules.md §5: "every condition is checked after each move"), so a game
 * never continues past the point at which it has been decided - unlike major
 * 2's "no legal move" check, which only ran at the start of a turn.
 *
 * Evaluates, in order:
 *
 * 1. **Flag capture (§5.1)** - the side missing its Flag loses, orthogonally
 *    or diagonally captured (that distinction is `movement.ts`'s, not this
 *    module's - by the time this runs the Flag is simply gone or not).
 * 2. **Mutual attrition (§5.3)** - checked *before* single-side attrition, on
 *    purpose: a move that leaves *both* sides with no numbered pieces is a
 *    draw, not a win for whichever side this function happened to check
 *    first. Getting this ordering right is the one place §5's own
 *    precedence has to be explicit rather than incidental.
 * 3. **Attrition (§5.2)** - a side left with no numbered pieces loses
 *    immediately. The Flag does not count.
 * 4. **Inactivity (§5.4)** - the shared counter has reached
 *    `INACTIVITY_LIMIT` (40) - the game is a draw.
 *
 * Returns `{ kind: "ongoing" }` if none of the above applies. Never returns
 * `"resignation"` or `"agreement"` - those are declared, not detected (see
 * module comment).
 */
export function computeOutcome(
  position: PositionState,
  activeSide: Side,
  inactivityCounter: number,
): GameOutcome {
  const opponent = otherSide(activeSide);

  // 1. §5.1 Flag capture - "does this side still have a Flag on the board".
  if (!hasFlag(position, activeSide)) {
    return { kind: "win", winner: opponent, reason: "flagCapture" };
  }
  if (!hasFlag(position, opponent)) {
    return { kind: "win", winner: activeSide, reason: "flagCapture" };
  }

  // 2. §5.3 Mutual attrition - checked before single-side attrition (see the
  // doc comment above) so a move leaving both sides without a numbered piece
  // resolves as a draw, never as a win for whoever is checked next.
  const activeInAttrition = isInAttrition(position, activeSide);
  const opponentInAttrition = isInAttrition(position, opponent);
  if (activeInAttrition && opponentInAttrition) {
    return { kind: "draw", reason: "mutualAttrition" };
  }

  // 3. §5.2 Attrition - one side alone with no numbered pieces loses.
  if (activeInAttrition) {
    return { kind: "win", winner: opponent, reason: "attrition" };
  }
  if (opponentInAttrition) {
    return { kind: "win", winner: activeSide, reason: "attrition" };
  }

  // 4. §5.4 The shared inactivity counter at the limit - a draw.
  if (inactivityCounter >= INACTIVITY_LIMIT) {
    return { kind: "draw", reason: "inactivity" };
  }

  return { kind: "ongoing" };
}

// Countdown warnings for the two Phase-2 rule-state clocks (rules.md
// §6.4/§6.5), story 00000006 Step 8.
//
// `PlayState` (play.ts) already carries each side's inactivity counter and
// the shared progress counter; `outcome.ts` already knows the limits at
// which they end the game (`INACTIVITY_LIMIT` = 50, `PROGRESS_LIMIT` = 80).
// This module adds nothing to rule state or rule logic - it is a thin,
// pure, presentation-only layer that decides *when* a counter is close
// enough to warn about and *what to say*, so the UI (Step 11's banner
// component) only has to render text it does not have to compose, and so
// the wording is unit-testable in this project's `node` Vitest environment.
//
// The two warning thresholds are fixed by the story, not open to redesign
// here:
//
//  - an **inactivity** warning, shown to a player only while it is their
//    turn, once **10 or fewer** of their own moves remain before their
//    50-move inactivity loss (their counter at 40 or above) - it must state
//    how many moves remain and that an attack resets it;
//  - a **no-progress** warning, shown to both players once **20 or fewer**
//    combined moves remain before the shared 80-move no-progress draw (the
//    progress counter at 60 or above) - it must state the remaining count.
//
// Both warnings disappear the moment the game is over (`play.result.kind !==
// "ongoing"`), and each disappears independently the moment its own counter
// resets (an attack, for inactivity; a capture, for progress) or the game
// ends before the threshold is reached.
//
// No React dependency - pure over `PlayState` (play.ts).

import type { Side } from "../rules/primary/v1/board.ts";
import {
  INACTIVITY_LIMIT,
  PROGRESS_LIMIT,
} from "../rules/primary/v1/outcome.ts";
import type { PlayState } from "../rules/primary/v1/play.ts";
import { sideColorName } from "./sideNames.ts";

/** How many of a player's own moves may remain before the inactivity warning appears (story-fixed). */
const INACTIVITY_WARNING_THRESHOLD = 10;

/** How many combined moves may remain before the no-progress warning appears (story-fixed). */
const PROGRESS_WARNING_THRESHOLD = 20;

/**
 * The inactivity countdown warning (rules.md §6.4), shown only to the player
 * whose turn it is, once 10 or fewer of *their own* moves remain before
 * their personal counter reaches `INACTIVITY_LIMIT` and they lose.
 */
export interface InactivityWarning {
  readonly kind: "inactivity";
  /** The side this warning is for - always the side to move. */
  readonly side: Side;
  /** How many of this side's own moves remain before the loss. */
  readonly movesRemaining: number;
  /** Player-facing sentence: names the color, the count, and that an attack resets it. */
  readonly message: string;
}

/**
 * The no-progress countdown warning (rules.md §6.5), shown to both players
 * alike once 20 or fewer combined moves remain before the shared counter
 * reaches `PROGRESS_LIMIT` and the game is a draw.
 */
export interface NoProgressWarning {
  readonly kind: "noProgress";
  /** How many combined moves remain before the draw. */
  readonly movesRemaining: number;
  /** Player-facing sentence: names the count. */
  readonly message: string;
}

/** Zero, one, or both of the countdown warnings currently in effect for `play`. */
export interface CountdownWarnings {
  readonly inactivity: InactivityWarning | null;
  readonly noProgress: NoProgressWarning | null;
}

/**
 * Computes the countdown warnings currently in effect for `play`. Returns
 * `{ inactivity: null, noProgress: null }` once the game has ended
 * (`play.result.kind !== "ongoing"`) - a finished game has no clocks left to
 * warn about.
 *
 * The inactivity warning only ever names `play.sideToMove` - the same
 * counter, examined on the *other* side's turn, produces no warning (per
 * in-scope item 4: "that player sees a warning while it is their turn"). The
 * no-progress warning is side-agnostic and appears identically regardless of
 * whose turn it is.
 */
export function computeCountdownWarnings(play: PlayState): CountdownWarnings {
  if (play.result.kind !== "ongoing") {
    return { inactivity: null, noProgress: null };
  }

  const side = play.sideToMove;
  const inactivityMovesRemaining =
    INACTIVITY_LIMIT - play.inactivityCounters[side];
  const inactivity: InactivityWarning | null =
    inactivityMovesRemaining <= INACTIVITY_WARNING_THRESHOLD
      ? {
          kind: "inactivity",
          side,
          movesRemaining: inactivityMovesRemaining,
          message: describeInactivityWarning(side, inactivityMovesRemaining),
        }
      : null;

  const progressMovesRemaining = PROGRESS_LIMIT - play.progressCounter;
  const noProgress: NoProgressWarning | null =
    progressMovesRemaining <= PROGRESS_WARNING_THRESHOLD
      ? {
          kind: "noProgress",
          movesRemaining: progressMovesRemaining,
          message: describeNoProgressWarning(progressMovesRemaining),
        }
      : null;

  return { inactivity, noProgress };
}

/** Player-facing "N move(s)" - singular for exactly one, plural otherwise. */
function moveWord(count: number): string {
  return count === 1 ? "move" : "moves";
}

/**
 * The inactivity warning's sentence, naming the at-risk side, the remaining
 * count, and that an attack of theirs resets the count (rules.md §6.4).
 */
function describeInactivityWarning(side: Side, movesRemaining: number): string {
  const color = sideColorName(side);
  return `${color}, only ${movesRemaining} ${moveWord(movesRemaining)} remain before you lose to inactivity — an attack resets this count.`;
}

/**
 * The no-progress warning's sentence, naming the remaining combined count
 * (rules.md §6.5). Applies to both players alike, so it names no side.
 */
function describeNoProgressWarning(movesRemaining: number): string {
  return `Only ${movesRemaining} ${moveWord(movesRemaining)} remain (combined) before the game is a draw by no progress.`;
}

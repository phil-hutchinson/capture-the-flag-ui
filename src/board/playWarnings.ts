// Countdown warning for the single shared inactivity clock (rules.md §5.3).
//
// `PlayState` (play.ts) already carries the shared inactivity counter;
// `outcome.ts` already knows the limit at which it ends the game as a draw
// (`INACTIVITY_LIMIT` = 50). This module adds nothing to rule state or rule
// logic - it is a thin, pure, presentation-only layer that decides *when*
// the counter is close enough to warn about and *what to say*, so the UI
// (`PlayWarnings.tsx`) only has to render text it does not have to compose,
// and so the wording is unit-testable in this project's `node` Vitest
// environment.
//
// The warning is **side-agnostic**: 1.2 has no per-player inactivity loss
// (that mechanic is gone with ruleset 1.1), only the single shared draw, so
// the warning is shown identically to both players regardless of whose turn
// it is, once **10 or fewer** combined moves remain before the shared
// 50-move inactivity draw (the counter at 40 or above) - it must state how
// many moves remain and that any move that removes a piece resets it.
//
// The warning disappears the moment the game is over (`play.result.kind !==
// "ongoing"`) or the counter resets (any move that removes a piece).
//
// No React dependency - pure over `PlayState` (play.ts).

import { INACTIVITY_LIMIT } from "../rules/primary/v1/outcome.ts";
import type { PlayState } from "../rules/primary/v1/play.ts";

/** How many combined moves may remain before the inactivity warning appears (story-fixed). */
const INACTIVITY_WARNING_THRESHOLD = 10;

/**
 * The inactivity countdown warning (rules.md §5.3), shown to both players
 * alike once 10 or fewer combined moves remain before the shared counter
 * reaches `INACTIVITY_LIMIT` and the game is a draw.
 */
export interface InactivityWarning {
  readonly kind: "inactivity";
  /** How many combined moves remain before the draw. */
  readonly movesRemaining: number;
  /** Player-facing sentence: names the count and that a capture resets it. */
  readonly message: string;
}

/** Zero or one countdown warning currently in effect for `play`. */
export interface CountdownWarnings {
  readonly inactivity: InactivityWarning | null;
}

/**
 * Computes the countdown warning currently in effect for `play`. Returns
 * `{ inactivity: null }` once the game has ended (`play.result.kind !==
 * "ongoing"`) - a finished game has no clock left to warn about.
 */
export function computeCountdownWarnings(play: PlayState): CountdownWarnings {
  if (play.result.kind !== "ongoing") {
    return { inactivity: null };
  }

  const movesRemaining = INACTIVITY_LIMIT - play.inactivityCounter;
  const inactivity: InactivityWarning | null =
    movesRemaining <= INACTIVITY_WARNING_THRESHOLD
      ? {
          kind: "inactivity",
          movesRemaining,
          message: describeInactivityWarning(movesRemaining),
        }
      : null;

  return { inactivity };
}

/** Player-facing "N move(s)" - singular for exactly one, plural otherwise. */
function moveWord(count: number): string {
  return count === 1 ? "move" : "moves";
}

/**
 * The inactivity warning's sentence, naming the remaining combined count and
 * that removing a piece resets it (rules.md §5.3). Applies to both players
 * alike, so it names no side.
 */
function describeInactivityWarning(movesRemaining: number): string {
  return `Only ${movesRemaining} ${moveWord(movesRemaining)} remain (combined) before the game is a draw by inactivity — removing a piece resets this count.`;
}

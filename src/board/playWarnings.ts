// Countdown warning for a shared inactivity clock (rules.md §5.3 at major 2;
// `reference/rules.md` §5 at major 3).
//
// A play state (either major's `PlayState`) already carries the shared
// inactivity counter, and each major's own `outcome.ts` already knows the
// limit at which it ends the game as a draw (`INACTIVITY_LIMIT` - 50 at
// major 2, 40 at major 3). This module adds nothing to rule state or rule
// logic - it is a thin, pure, presentation-only layer that decides *when*
// the counter is close enough to warn about and *what to say*, so the UI
// (`PlayWarnings.tsx`) only has to render text it does not have to compose,
// and so the wording is unit-testable in this project's `node` Vitest
// environment.
//
// Story 00000036, Step 13: this module stopped taking a major-2 `PlayState`
// directly - taking one would mean either importing major 2's type from a
// major-3 caller or duplicating this whole module for major 3, and the
// wording and the 10-move threshold are identical at both majors. Instead it
// takes exactly the three primitives it needs: whether the game is ongoing,
// the current inactivity counter, and the **limit** the counter is being
// measured against. Neither major's `PlayState` is imported here. Major 2's
// callers pass `INACTIVITY_LIMIT` from `rules/primary/v2/outcome.ts` (50); a
// Demotion game passes v3's own `INACTIVITY_LIMIT` (40) from
// `rules/primary/v3/outcome.ts`. One wording, two limits, no duplicated
// sentence.
//
// The warning is **side-agnostic**: neither major has a per-player
// inactivity loss, only a single shared draw, so the warning is shown
// identically to both players regardless of whose turn it is, once **10 or
// fewer** combined moves remain before the shared inactivity draw (the
// counter within 10 of the limit) - it must state how many moves remain and
// that any move that removes a piece resets it.
//
// The warning disappears the moment the game is over (`ongoing` is `false`)
// or the counter resets (any move that removes a piece).
//
// No React dependency - pure over primitive values, so it has no dependency
// on either major's rule layer.

/** How many combined moves may remain before the inactivity warning appears (story-fixed). */
const INACTIVITY_WARNING_THRESHOLD = 10;

/**
 * The inactivity countdown warning (rules.md §5.3), shown to both players
 * alike once 10 or fewer combined moves remain before the shared counter
 * reaches the caller's inactivity limit and the game is a draw.
 */
export interface InactivityWarning {
  readonly kind: "inactivity";
  /** How many combined moves remain before the draw. */
  readonly movesRemaining: number;
  /** Player-facing sentence: names the count and that a capture resets it. */
  readonly message: string;
}

/** Zero or one countdown warning currently in effect. */
export interface CountdownWarnings {
  readonly inactivity: InactivityWarning | null;
}

/**
 * Computes the countdown warning currently in effect. Returns
 * `{ inactivity: null }` once the game has ended (`ongoing` is `false`) - a
 * finished game has no clock left to warn about.
 *
 * @param ongoing Whether the game is still in progress (`play.result.kind
 *   === "ongoing"`, for whichever major's `PlayState` the caller holds).
 * @param inactivityCounter The play state's current shared inactivity
 *   counter.
 * @param limit The counter value at which the game becomes a draw by
 *   inactivity - major 2's `INACTIVITY_LIMIT` (50) or major 3's (40).
 */
export function computeCountdownWarnings(
  ongoing: boolean,
  inactivityCounter: number,
  limit: number,
): CountdownWarnings {
  if (!ongoing) {
    return { inactivity: null };
  }

  const movesRemaining = limit - inactivityCounter;
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

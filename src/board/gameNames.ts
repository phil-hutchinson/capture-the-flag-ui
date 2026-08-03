// Player-facing naming for the two games (story 00000023, Step 7).
//
// Mirrors `sideNames.ts`'s single-home-for-a-mapping precedent: both
// `GameChoice.tsx` and `HotSeatGame.tsx`'s post-choice announcement need the
// same "Battle" / "Skirmish" wording and the same plain-language board-size
// phrase, so it is defined once here rather than redeclared in both.

import type { Edition, EditionId } from "../rules/primary/v2/edition.ts";

/** The player-facing game name - "Battle" or "Skirmish" - never the internal edition id. */
export function gameName(edition: Edition): string {
  return edition.id === "2-0:BATTLE" ? "Battle" : "Skirmish";
}

/**
 * A short, plain-language description of the board size, article included -
 * e.g. "an 8x8 board", "a 12x12 board" - for a sentence like "Placing on an
 * 8x8 board." Only ever called with the two published editions (Battle,
 * Skirmish), so the article is a direct, hand-picked pair rather than a
 * general number-to-article rule.
 */
export function boardSizeDescription(edition: Edition): string {
  const { columnCount, rowCount } = edition.boardLayout;
  const article = columnCount === 8 ? "an" : "a";
  return `${article} ${columnCount}x${rowCount} board`;
}

/**
 * Which game `GameChoice` should pre-select: the game most recently played
 * this session, if any, otherwise Skirmish. Owner feedback at the Step 7
 * manual gate (2026-08-01): on the very first game of a session `lastPlayed`
 * is `null` and Skirmish stays pre-selected, per story.md's "recommended
 * first game" - but after a finished game and "New game" (which returns to
 * this picker), the picker should default to whichever game was just played,
 * not reset to Skirmish every time.
 */
export function defaultGameId(lastPlayed: Edition | null): EditionId {
  return lastPlayed?.id ?? "2-0:SKIRMISH";
}

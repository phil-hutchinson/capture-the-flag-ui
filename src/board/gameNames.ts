// Player-facing naming for the three games (story 00000023, Step 7; extended
// to a third game by story 00000030's Step 9).
//
// Mirrors `sideNames.ts`'s single-home-for-a-mapping precedent: both
// `GameChoice.tsx` and `HotSeatGame.tsx`'s post-choice announcement need the
// same "Battle" / "Skirmish" / "Clash" wording and the same plain-language
// board-size phrase, so it is defined once here rather than redeclared in
// both.
//
// Story 00000030's implementation plan, Decision 7: an edition id no longer
// identifies a game one-to-one (`2-0:BATTLE` now names both Battle and
// Clash, depending on its flags), so naming follows the *game* -
// `games.ts`'s `GameId` - rather than the edition. `gameName` below is
// exhaustive over `GameId` (a fourth game fails to compile here until it has
// a name); `gameNameForConfiguration` is the `RuleConfiguration`-taking
// variant, built on `games.ts`'s `identifyGame`, for a caller that only has a
// configuration in hand (a live game, or a record being reviewed) and needs
// to know which game it actually is.

import type { RuleConfiguration } from "../rules/primary/v2/configuration.ts";
import { identifyGame, type GameId } from "../rules/primary/v2/games.ts";

/**
 * Per-`GameId` player-facing name. Deliberate and exhaustive (rather than
 * "Battle if ..., else Skirmish") so a fourth game fails to compile here
 * instead of silently falling into the wrong name.
 */
const GAME_NAME: Readonly<Record<GameId, string>> = {
  battle: "Battle",
  skirmish: "Skirmish",
  clash: "Clash",
};

/** The player-facing game name - "Battle", "Skirmish" or "Clash" - never the internal `GameId` or an edition id. */
export function gameName(id: GameId): string {
  return GAME_NAME[id];
}

/**
 * The player-facing name of whichever game `configuration` is, or `null` if
 * it matches no catalogued game - e.g. a record whose `Ruleset` tag carried a
 * token this app could not resolve, so its configuration's board or army
 * falls back to its edition's own rather than naming a real game (see
 * `readRecord.ts`, story 00000030's Step 8). Matches by `identifyGame`'s own
 * `(BOARD_LAYOUT, ARMY_COMPOSITION)` comparison, so both Skirmish editions
 * (active and superseded) name the same game, "Skirmish".
 */
export function gameNameForConfiguration(
  configuration: RuleConfiguration,
): string | null {
  const id = identifyGame(configuration);
  return id === null ? null : GAME_NAME[id];
}

/**
 * A short, plain-language description of the board size, article included -
 * e.g. "an 8x8 board", "a 12x12 board" - for a sentence like "Placing on an
 * 8x8 board." Reads `configuration`'s own resolved board layout (story
 * 00000030's Decision 1) rather than its edition's - a configuration's board
 * is not always its edition's own (Clash names `BATTLE_EDITION` but plays a
 * 10x10 board). Only ever called with configurations resolving to one of the
 * three known boards (8x8, 10x10, 12x12) today, so the article is a direct,
 * hand-picked set rather than a general number-to-article rule.
 */
export function boardSizeDescription(configuration: RuleConfiguration): string {
  const { columnCount, rowCount } = configuration.boardLayout;
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
 * not reset to Skirmish every time. Story 00000030's Decision 7: takes the
 * last-played *configuration* rather than a bare edition, and identifies its
 * game with `identifyGame` (falling back to Skirmish on the practically
 * unreachable case of a configuration matching no catalogued game, so this
 * function is still total).
 */
export function defaultGameId(lastPlayed: RuleConfiguration | null): GameId {
  if (lastPlayed === null) {
    return "skirmish";
  }
  return identifyGame(lastPlayed) ?? "skirmish";
}

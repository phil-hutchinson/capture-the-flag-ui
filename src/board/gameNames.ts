// Player-facing naming for the games (story 00000023, Step 7; extended to a
// third game by story 00000030's Step 9).
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
// `games.ts`'s `GameId` - rather than the edition. `gameNameForConfiguration`
// is the `RuleConfiguration`-taking variant, built on `games.ts`'s
// `identifyGame`, for a caller that only has a configuration in hand (a live
// game, or a record being reviewed) and needs to know which game it actually
// is. This function stays major-2-only (story 00000036's implementation
// plan, Step 12: the reviewer and the placement announcement are both
// major-2-only concerns), so it still speaks `games.ts`'s own `GameId`, not
// the app-level `AppGameId`.
//
// Story 00000036's implementation plan, Step 12: `gameName` and
// `defaultGameId` below are re-pointed at `../games/gameCatalog.ts`'s
// `AppGameId`/`GAME_CATALOG`/`GameSelection` - the identity layer that spans
// both ruleset majors - rather than major 2's own `GameId`. Every major-2
// `GameId` string is also a valid `AppGameId` string (the three literals are
// identical), so `gameNameForConfiguration` below simply calls `gameName`
// with the `GameId` `identifyGame` returns, rather than keeping a second,
// duplicate name record here.
//
// Step 10 adds `reviewedGameLine`, the pure helper behind `ReviewScreen.tsx`'s
// "This is a Clash game, on a 10x10 board." line (Decision 11): it decides
// whether that line should be shown at all, given a record can carry a
// `Ruleset` tag token this app could not resolve at all.

import type { AppGameId, GameSelection } from "../games/gameCatalog.ts";
import { GAME_CATALOG } from "../games/gameCatalog.ts";
import type { RuleConfiguration } from "../rules/primary/v2/configuration.ts";
import { identifyGame } from "../rules/primary/v2/games.ts";

/** The player-facing game name - "Skirmish", "Clash", "Battle" or "Demotion" - never the internal `AppGameId` or an edition id. */
export function gameName(id: AppGameId): string {
  return GAME_CATALOG[id].name;
}

/**
 * The player-facing name of whichever game `configuration` is, or `null` if
 * it matches no catalogued game - e.g. a record whose `Ruleset` tag carried a
 * token this app could not resolve, so its configuration's board or army
 * falls back to its edition's own rather than naming a real game (see
 * `readRecord.ts`, story 00000030's Step 8). Matches by `identifyGame`'s own
 * `(BOARD_LAYOUT, ARMY_COMPOSITION)` comparison, so both Skirmish editions
 * (active and superseded) name the same game, "Skirmish". Major-2-only; see
 * the module header.
 */
export function gameNameForConfiguration(
  configuration: RuleConfiguration,
): string | null {
  const id = identifyGame(configuration);
  return id === null ? null : gameName(id);
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
 * not reset to Skirmish every time.
 *
 * Story 00000036's implementation plan, Step 12: takes a `GameSelection`
 * (the app-level identity, above both majors) rather than a `RuleConfiguration`,
 * and simply returns its `gameId` - `GameSelection` already names the game
 * directly, so there is no lookup to fall back from, and this holds across a
 * major boundary without any special-casing: it returns Demotion just as
 * readily as it returns Battle, Skirmish or Clash.
 */
export function defaultGameId(lastPlayed: GameSelection | null): AppGameId {
  if (lastPlayed === null) {
    return "skirmish";
  }
  return lastPlayed.gameId;
}

/**
 * The review screen's one-line game identification (story 00000030's Step
 * 10, Decision 11) - `"This is a Clash game, on a 10x10 board."` - or `null`
 * when it should be omitted. Pure so it is unit-testable without mounting
 * `ReviewScreen.tsx`.
 *
 * Shown only when **both** hold: `unrecognizedRuleTokens` (`readRecord.ts`'s
 * field of that name - always `[]` for a record this app fully understood)
 * is empty, **and** `configuration` matches a catalogued game. Both checks
 * matter, not just the first: with an unresolved `BOARD_LAYOUT` or
 * `ARMY_COMPOSITION` token, `configuration`'s own resolved board/army falls
 * back to its edition's own (`readRecord.ts`), so `gameNameForConfiguration`
 * could otherwise happily name a game the record was never actually played
 * as - Decision 11 calls that out explicitly as the failure this guards
 * against.
 */
export function reviewedGameLine(
  configuration: RuleConfiguration,
  unrecognizedRuleTokens: readonly string[],
): string | null {
  if (unrecognizedRuleTokens.length > 0) {
    return null;
  }
  const name = gameNameForConfiguration(configuration);
  if (name === null) {
    return null;
  }
  return `This is a ${name} game, on ${boardSizeDescription(configuration)}.`;
}

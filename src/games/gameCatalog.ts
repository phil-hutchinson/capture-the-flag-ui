// The app-level game catalog (story 00000036, implementation plan Decision
// 3): the identity layer for "which game is this", independent of which
// ruleset major it belongs to.
//
// Before this story, a game was identified by major 2's own `GameId`
// (`games.ts`) everywhere - `GameChoice.tsx`'s picker, `gameNames.ts`'s
// naming helpers, and `App.tsx`'s "last played" session memory all spoke
// major-2 vocabulary directly. That stops working once a second major
// (`src/rules/primary/v3/`) exists: a game the app offers has to be
// identifiable on its own, without either major's types leaking into the
// other's. This module is that identity, sitting *above* both majors.
//
// `AppGameId` names every game this app can ever offer - Skirmish, Clash and
// Battle (major 2) plus Demotion (major 3) - and is present in full from this
// step onward, even though `offeredGames()` does not yet include Demotion
// (see below). `GAME_CATALOG` is an exhaustive `Record<AppGameId, ...>`, so a
// fifth game fails to compile here until it has an entry, mirroring the
// exhaustiveness `GameChoice.tsx`'s old `GAME_DETAIL`/`gameOrderRank` and
// `gameNames.ts`'s old `GAME_NAME` were written for. Each entry carries its
// player-facing name and description (the three major-2 entries' copy is
// moved verbatim from those old records - not reworded - so the picker's
// visible text is unchanged by this migration), its display order, a
// plain-language board-size phrase, and its **source**: which major it comes
// from, and - for a major-2 game - that major's own `GameId`.
//
// `GameSelection` replaces `App.tsx`'s old "last played `RuleConfiguration`"
// session memory: the `AppGameId` just played, plus the player's major-2 rule
// choices (the two diagonal-attack flag values - `ruleFlags.ts`'s
// `RuleChoiceFlagId`s). Carrying the rule choices through even when the game
// played was Demotion (which ignores them entirely - major 3 has no rule
// settings) is what lets the picker bring the "Diagonal attacks" section back
// with its previous selections intact after a player switches away from and
// then back to a major-2 game, across a Demotion game in between.

import { playableGames, type GameId } from "../rules/primary/v2/games.ts";
import type { RuleConfiguration } from "../rules/primary/v2/configuration.ts";
import {
  RULE_CHOICE_FLAG_IDS,
  type ResolvedRuleFlags,
  type RuleChoiceFlagId,
} from "../rules/primary/v2/ruleFlags.ts";

/** Identifies any game this app can offer, independent of which ruleset major it belongs to. */
export type AppGameId = "skirmish" | "clash" | "battle" | "demotion";

/** Every `AppGameId`, in catalog-declaration order (display order is `GAME_CATALOG[id].order`, a separate concern - see `offeredGames` below). */
export const APP_GAME_IDS: readonly AppGameId[] = [
  "skirmish",
  "clash",
  "battle",
  "demotion",
];

/** A catalogued game's rules come from major 2's own game catalog (`games.ts`). */
export interface GameCatalogSourceV2 {
  readonly major: 2;
  readonly gameId: GameId;
}

/** A catalogued game's rules come from major 3, which has no `GameId` of its own - there is exactly one major-3 game, Demotion. */
export interface GameCatalogSourceV3 {
  readonly major: 3;
}

export type GameCatalogSource = GameCatalogSourceV2 | GameCatalogSourceV3;

export interface GameCatalogEntry {
  readonly id: AppGameId;
  /** The player-facing name - "Skirmish", "Clash", "Battle" or "Demotion" - never an internal id or an edition id. */
  readonly name: string;
  /** The one-or-two-sentence plain-language description shown beneath the selected game's button. */
  readonly description: string;
  /** Display order in the picker; lower sorts first. See `offeredGames`. */
  readonly order: number;
  /** A short, plain-language board-size phrase, article included - e.g. "an 8x8 board" - matching `gameNames.ts`'s `boardSizeDescription`. */
  readonly boardSizePhrase: string;
  readonly source: GameCatalogSource;
}

/**
 * Every game this app can offer, keyed by `AppGameId`. Exhaustive by
 * construction (`Record<AppGameId, GameCatalogEntry>`), so a fifth game fails
 * to compile here until it has an entry.
 *
 * The three major-2 entries' `name` and `description` are moved verbatim from
 * `GameChoice.tsx`'s old `GAME_DETAIL` and `gameNames.ts`'s old `GAME_NAME` -
 * character for character, not reworded - and their `order` values (0, 1, 2)
 * match the old `gameOrderRank`'s Skirmish-then-Clash-then-Battle order.
 *
 * Demotion's `name`, `description` and `boardSizePhrase` are story.md's
 * fixed copy. Its `order` (3, last) is Decision 4: appending it after the
 * three settled major-2 entries, rather than slotting it in by board size,
 * keeps them in their existing positions and keeps Skirmish - "the
 * recommended game for a new player" - the thing a first-time viewer meets
 * first.
 */
export const GAME_CATALOG: Readonly<Record<AppGameId, GameCatalogEntry>> = {
  skirmish: {
    id: "skirmish",
    name: "Skirmish",
    description: "Play on an 8x8 board with a 16-piece army.",
    order: 0,
    boardSizePhrase: "an 8x8 board",
    source: { major: 2, gameId: "skirmish" },
  },
  clash: {
    id: "clash",
    name: "Clash",
    description: "Play on a 10x10 board with a 20-piece army. Irregular lakes.",
    order: 1,
    boardSizePhrase: "a 10x10 board",
    source: { major: 2, gameId: "clash" },
  },
  battle: {
    id: "battle",
    name: "Battle",
    description: "Play on a 12x12 board with a 25-piece army.",
    order: 2,
    boardSizePhrase: "a 12x12 board",
    source: { major: 2, gameId: "battle" },
  },
  demotion: {
    id: "demotion",
    name: "Demotion",
    description:
      "Play on an 8x8 fixed board. When a piece wins a battle, it is demoted one rank.",
    order: 3,
    boardSizePhrase: "an 8x8 board",
    source: { major: 3 },
  },
};

/**
 * The games actually offered for play, in display order. Every catalogued
 * major-2 game whose source `GameId` is in `games.ts`'s `playableGames()`
 * (the existing `combinationFits` floor, unchanged - see that module's own
 * comment), plus Demotion.
 *
 * **Demotion is deliberately excluded here, for this step only.** `AppGameId`
 * and `GAME_CATALOG` carry it from the start (this module's own header), but
 * offering it - making it reachable and playable - is Step 14. Until then
 * this function's result is exactly the three major-2 games, in the same
 * order the picker has always shown them, so this step is a pure identity-
 * layer migration with no visible change.
 */
const OFFERED_GAME_IDS: readonly AppGameId[] = APP_GAME_IDS.filter((id) => {
  const entry = GAME_CATALOG[id];
  if (entry.source.major === 3) {
    return false;
  }
  return playableGames().includes(entry.source.gameId);
}).sort((a, b) => GAME_CATALOG[a].order - GAME_CATALOG[b].order);

/** The games actually offered for play; see `OFFERED_GAME_IDS`. */
export function offeredGames(): readonly AppGameId[] {
  return OFFERED_GAME_IDS;
}

/** The player's chosen value for each of the two diagonal-attack rule-choice flags - `ruleFlags.ts`'s `RuleChoiceFlagId`s, fully resolved (never a partial override). */
export type GameRuleChoices = {
  readonly [Id in RuleChoiceFlagId]: ResolvedRuleFlags[Id];
};

/**
 * The session memory `App.tsx` holds across a game: the `AppGameId` just
 * played, plus the player's major-2 rule choices. For a Demotion game the
 * rule choices are simply whatever was showing on the picker when Demotion
 * was chosen, carried through untouched even though Demotion's own rules
 * ignore them entirely - major 3 publishes no rule settings (story.md). This
 * is what lets the picker's "Diagonal attacks" section come back with its
 * previous selections intact after switching away from, and back to, a
 * major-2 game across a Demotion game in between.
 */
export interface GameSelection {
  readonly gameId: AppGameId;
  readonly ruleChoices: GameRuleChoices;
}

/**
 * Reads both diagonal-attack rule-choice flags off an already-built
 * `RuleConfiguration`, as a `GameRuleChoices` - the resolved values a
 * `GameSelection` carries forward. Iterates `RULE_CHOICE_FLAG_IDS` rather
 * than naming the two flags twice, so a third rule-choice flag would be
 * picked up here without an edit; the cast mirrors `GameChoice.tsx`'s own
 * `flagOverrides` casts for the same "generic id, specific value" reason.
 */
export function ruleChoicesFromConfiguration(
  configuration: RuleConfiguration,
): GameRuleChoices {
  const choices: Partial<Record<RuleChoiceFlagId, string>> = {};
  for (const flagId of RULE_CHOICE_FLAG_IDS) {
    choices[flagId] = configuration.flags[flagId];
  }
  return choices as GameRuleChoices;
}

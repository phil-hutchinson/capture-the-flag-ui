// The games catalog for ruleset major 2 (story 00000030, implementation
// plan Decision 6): the picker offers *games*, not editions.
//
// `edition.ts`'s `EditionId` no longer identifies a game one-to-one: Clash
// names `BATTLE_EDITION` as its edition (the "messy stamp" story.md's Policy
// accepts) while playing a different board and a different army entirely, so
// two of the three games this app offers share an edition id. This module is
// the new, small piece of rules-layer data the picker (`GameChoice.tsx`) and
// the reviewer (`ReviewScreen.tsx`, Step 10) actually need: a `GameId` union,
// one catalog entry per game (its base edition plus the game-defining flag
// values - `BOARD_LAYOUT`/`ARMY_COMPOSITION` - it states), a function that
// builds a game's standard `RuleConfiguration`, the list of playable games,
// and `identifyGame` - the reverse lookup from a `RuleConfiguration` back to
// the `GameId` it matches, if any.
//
// `GAMES` is exhaustive over `GameId` by construction (`Record<GameId,
// GameEntry>`), preserving the property `GameChoice.tsx`'s old
// `GAME_DETAIL`/`gameOrderRank` were written for: a fourth game fails to
// compile here until it has an entry.

import {
  combinationFits,
  BATTLE_EDITION,
  SKIRMISH_EDITION,
  type Edition,
} from "./edition.ts";
import {
  configureRules,
  type RuleConfiguration,
  type RuleFlagOverrides,
} from "./configuration.ts";
import type {
  GameDefiningFlagId,
  ResolvedRuleFlags,
  RuleChoiceFlagId,
} from "./ruleFlags.ts";

/** Identifies one of the three games this app offers, independent of edition id. */
export type GameId = "battle" | "skirmish" | "clash";

/** Every `GameId`, in the order declared below (display order is a picker concern, not this module's - see `GameChoice.tsx`'s `gameOrderRank`). */
export const GAME_IDS: readonly GameId[] = ["battle", "skirmish", "clash"];

/**
 * The game-defining flag values a game's own catalog entry states - e.g.
 * Clash's `ARMY_COMPOSITION`/`BOARD_LAYOUT` overrides on top of
 * `BATTLE_EDITION`. Battle's and Skirmish's entries state none: their
 * game-defining flags already resolve correctly from their own edition (see
 * `configuration.ts`'s `resolvedEditionValue`).
 */
export type GameDefiningOverrides = {
  readonly [Id in GameDefiningFlagId]?: ResolvedRuleFlags[Id];
};

/**
 * The rule-choice flag values a caller of `buildGameConfiguration` may layer
 * on top of a game's standard configuration - today, the two diagonal flags.
 * This is how `GameChoice.tsx` applies a player's diagonal-attack choices on
 * top of whichever game they picked, without being able to accidentally
 * override a game-defining flag through the same mechanism.
 */
export type RuleChoiceOverrides = {
  readonly [Id in RuleChoiceFlagId]?: ResolvedRuleFlags[Id];
};

export interface GameEntry {
  readonly id: GameId;
  readonly edition: Edition;
  readonly gameDefiningOverrides: GameDefiningOverrides;
}

/**
 * Every game this app offers, keyed by its `GameId`. Battle and Skirmish are
 * simply their own active edition, stating no overrides - their standard
 * configuration is that edition's standard configuration, unchanged from
 * before this story. Clash (story.md's Policy: "records as a deviation from
 * Battle") is `BATTLE_EDITION` with both game-defining flags overridden to
 * the Clash values - there is no published edition for Clash, and this app
 * must not invent one.
 */
export const GAMES: Readonly<Record<GameId, GameEntry>> = {
  battle: {
    id: "battle",
    edition: BATTLE_EDITION,
    gameDefiningOverrides: {},
  },
  skirmish: {
    id: "skirmish",
    edition: SKIRMISH_EDITION,
    gameDefiningOverrides: {},
  },
  clash: {
    id: "clash",
    edition: BATTLE_EDITION,
    gameDefiningOverrides: {
      ARMY_COMPOSITION: "standard_clash",
      BOARD_LAYOUT: "asymmetric_100",
    },
  },
};

/**
 * Builds `gameId`'s standard `RuleConfiguration`, with `ruleChoiceOverrides`
 * (the two diagonal flags, if a caller chooses non-default values for them)
 * layered on top of the game's own game-defining overrides. The one place a
 * `GameId` becomes a `RuleConfiguration` - mirrors `configureRules` being the
 * one place an `Edition` becomes one.
 */
export function buildGameConfiguration(
  gameId: GameId,
  ruleChoiceOverrides: RuleChoiceOverrides = {},
): RuleConfiguration {
  const entry = GAMES[gameId];
  return configureRules(entry.edition, {
    ...entry.gameDefiningOverrides,
    ...ruleChoiceOverrides,
  } as RuleFlagOverrides);
}

/**
 * The key `GAME_BY_FLAG_PAIR` is built and looked up by: a game's resolved
 * `(BOARD_LAYOUT, ARMY_COMPOSITION)` pair, joined so two distinct pairs can
 * never collide on one string (neither flag's values ever contain `|`; see
 * `ruleFlags.ts`'s catalog).
 */
function gameFlagPairKey(
  boardLayout: ResolvedRuleFlags["BOARD_LAYOUT"],
  armyComposition: ResolvedRuleFlags["ARMY_COMPOSITION"],
): string {
  return `${boardLayout}|${armyComposition}`;
}

/**
 * Module-level lookup from a resolved `(BOARD_LAYOUT, ARMY_COMPOSITION)` pair
 * to the `GameId` that pair identifies, built once from `GAMES` at module
 * load rather than rebuilt on every `identifyGame` call (peer review #6:
 * `identifyGame` is called on several render paths - `ReviewScreen`,
 * `GameRecord`, `HotSeatGame`, `defaultGameId` - and was reconstructing all
 * three catalog configurations, three `configureRules` calls, every time).
 * Still exactly one source of truth: this is *derived* from `GAMES` via
 * `buildGameConfiguration`, never hand-written, so a change to the catalog
 * alone keeps the lookup correct.
 */
const GAME_BY_FLAG_PAIR: ReadonlyMap<string, GameId> = new Map(
  GAME_IDS.map((id) => {
    const configuration = buildGameConfiguration(id);
    return [
      gameFlagPairKey(
        configuration.flags.BOARD_LAYOUT,
        configuration.flags.ARMY_COMPOSITION,
      ),
      id,
    ] as const;
  }),
);

/**
 * The games actually offered for play, precomputed once alongside
 * `GAME_BY_FLAG_PAIR` for the same reason (`playableGames()` is called on
 * every render of the picker): every catalogued game whose resolved board
 * and army fit together, per `combinationFits`. All three catalog entries
 * are designed pairings that already fit - this filter is the floor
 * `combinationFits` was always meant to be, not the rule that decides which
 * games are offered (story.md's Design decisions & constraints: "the fit
 * test is the floor, not the rule"). The rule is the catalog above: only
 * three games are ever declared, out of the nine `BOARD_LAYOUT` x
 * `ARMY_COMPOSITION` combinations that would otherwise fit or not.
 */
const PLAYABLE_GAME_IDS: readonly GameId[] = GAME_IDS.filter((id) => {
  const configuration = buildGameConfiguration(id);
  return combinationFits(
    configuration.flags.BOARD_LAYOUT,
    configuration.flags.ARMY_COMPOSITION,
  );
});

/** The games actually offered for play; see `PLAYABLE_GAME_IDS`. */
export function playableGames(): readonly GameId[] {
  return PLAYABLE_GAME_IDS;
}

/**
 * Which game `configuration` is, if any: the catalogued game whose resolved
 * `(BOARD_LAYOUT, ARMY_COMPOSITION)` pair matches `configuration`'s own -
 * matched by that pair alone, ignoring both the edition id and the diagonal
 * flags (which are orthogonal and apply to all three games equally), via the
 * precomputed `GAME_BY_FLAG_PAIR`. `null` for a configuration matching no
 * catalogued game (e.g. a hand-built configuration pairing `standard_battle`
 * with `asymmetric_100` - a pairing that fits per `combinationFits` but that
 * this app never offers or produces).
 *
 * Matching by the flag pair rather than by edition id is deliberate: it
 * means a configuration built on the superseded `2-0:SKIRMISH` edition still
 * identifies as `"skirmish"` (its board and army are Skirmish's, even though
 * its edition id is not `SKIRMISH_EDITION`'s), and it is what lets Clash -
 * whose edition id names Battle - identify as `"clash"` rather than
 * `"battle"`.
 */
export function identifyGame(configuration: RuleConfiguration): GameId | null {
  return (
    GAME_BY_FLAG_PAIR.get(
      gameFlagPairKey(
        configuration.flags.BOARD_LAYOUT,
        configuration.flags.ARMY_COMPOSITION,
      ),
    ) ?? null
  );
}

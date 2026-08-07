// The flag catalog for ruleset major 2's rule flags: two proposed
// diagonal-attack flags (story 00000027, `DIAGONAL_ATTACKABLE` and
// `DIAGONAL_ATTACK_PATH`) plus, as of story 00000030, `BOARD_LAYOUT` and
// `ARMY_COMPOSITION` - the two flags that fix which board and army a game is
// played with.
//
// `BOARD_LAYOUT` and `ARMY_COMPOSITION` are *published* in `rules.md`
// Appendix A with two values each (`standard_144`/`standard_64` and
// `standard_battle`/`standard_skirmish`); this story adds a third,
// proposed-and-unpublished value to each (`asymmetric_100`,
// `standard_clash`) from the companion project's
// `doc/ruleset/proposed-variants.md` sandbox - see
// `doc/plan/00000030-implement-10x10-board/story.md`. The two diagonal flags
// remain wholly proposed, as before.
//
// This module is the *only* place any flag's identifier or its value strings
// are spelled - a rename is a one-file edit (story.md: "flag identifiers may
// still change"). It defines the catalog only: resolving a flag's value for
// a given edition, and building the `RuleConfiguration` a game is actually
// set up, played, recorded and replayed under, lives in `configuration.ts`.
// `boardLayout.ts` and `armyComposition.ts` import their id types
// (`BoardLayoutId`, `ArmyCompositionId`) from here rather than declaring them
// separately (story 00000030's implementation plan, Decision 4) - this
// module itself imports nothing from either, so there is no cycle.
//
// **Two kinds of flag** (story 00000030's implementation plan, Decision 5).
// `BOARD_LAYOUT` and `ARMY_COMPOSITION` are *game-defining*: a player chooses
// them by choosing a game (Battle/Skirmish/Clash), never as a toggle.
// `DIAGONAL_ATTACKABLE` and `DIAGONAL_ATTACK_PATH` are *rule choices*:
// offered as toggles on the new-game screen and described to a reviewer
// sentence by sentence. `RULE_FLAG_KIND` below classifies every flag id as
// exactly one of the two - `as const satisfies` requires an entry for every
// `RuleFlagId`, so a future flag fails to compile here until it is
// classified. `GAME_DEFINING_FLAG_IDS`/`RULE_CHOICE_FLAG_IDS` (and their
// matching id types) are derived from it, in `RULE_FLAG_IDS` order.

/**
 * The flag catalog: every flag this app knows, its permitted values and its
 * default. A third value for an existing flag, or a new flag entirely, is a
 * new/extended entry here, nothing more - every type below (`RuleFlagId`,
 * `RuleFlagValue`, `ResolvedRuleFlags`) is derived from this table, never
 * restated.
 *
 * - `ARMY_COMPOSITION` - which army roster a side fields (rules.md Appendix
 *   A). `standard_battle` (default, published): the 25-piece Battle army.
 *   `standard_skirmish` (published): the 16-piece Skirmish army.
 *   `standard_clash` (proposed, unpublished): the 20-piece Clash army - see
 *   `armyComposition.ts`.
 * - `BOARD_LAYOUT` - which board geometry a game is played on (rules.md
 *   Appendix A). `standard_144` (default, published): the 12x12 Battle
 *   board. `standard_64` (published): the 8x8 Skirmish board.
 *   `asymmetric_100` (proposed, unpublished): the 10x10 Clash board - see
 *   `boardLayout.ts`.
 * - `DIAGONAL_ATTACKABLE` - which enemy pieces a diagonal attack may target.
 *   `movable_only` (default): only a numbered (mobile) piece. `all`: any
 *   enemy piece, Towers and the Flag included - resolved by the same rank,
 *   equal-rank and formation-bonus rules as any other target (`combat.ts`
 *   already treats a Tower or Flag defender the same regardless of attack
 *   direction, so nothing beyond `movement.ts`'s target-legality check
 *   changes).
 * - `DIAGONAL_ATTACK_PATH` - whether a diagonal attack additionally needs a
 *   free flanking square. `always` (default): no, a diagonally adjacent
 *   enemy is always a legal target (subject to `DIAGONAL_ATTACKABLE`).
 *   `open_path`: yes, at least one of the two squares flanking the diagonal
 *   must be unoccupied by a piece of either side and not a lake.
 */
export const RULE_FLAG_CATALOG = {
  ARMY_COMPOSITION: {
    values: ["standard_battle", "standard_skirmish", "standard_clash"],
    default: "standard_battle",
  },
  BOARD_LAYOUT: {
    values: ["standard_144", "standard_64", "asymmetric_100"],
    default: "standard_144",
  },
  DIAGONAL_ATTACKABLE: {
    values: ["movable_only", "all"],
    default: "movable_only",
  },
  DIAGONAL_ATTACK_PATH: {
    values: ["always", "open_path"],
    default: "always",
  },
} as const satisfies Record<
  string,
  { values: readonly string[]; default: string }
>;

/** Identifies one of the flags this app knows. */
export type RuleFlagId = keyof typeof RULE_FLAG_CATALOG;

/** The permitted values for `flagId`, as a union type. */
export type RuleFlagValue<Id extends RuleFlagId> =
  (typeof RULE_FLAG_CATALOG)[Id]["values"][number];

/** A fully resolved value for every flag this app knows. */
export type ResolvedRuleFlags = {
  readonly [Id in RuleFlagId]: RuleFlagValue<Id>;
};

/** Convenience alias for `DIAGONAL_ATTACKABLE`'s value type. */
export type DiagonalAttackableValue = RuleFlagValue<"DIAGONAL_ATTACKABLE">;

/** Convenience alias for `DIAGONAL_ATTACK_PATH`'s value type. */
export type DiagonalAttackPathValue = RuleFlagValue<"DIAGONAL_ATTACK_PATH">;

/**
 * Every flag id, alphabetically sorted - matching the `Ruleset` tag's
 * required ordering (companion repository's `technical-notes.md`, "Record
 * file format"). Sorted explicitly rather than merely relying on the
 * catalog's declaration order being alphabetical (peer review #4): today
 * `Object.keys(RULE_FLAG_CATALOG)` already yields `ARMY_COMPOSITION`,
 * `BOARD_LAYOUT`, `DIAGONAL_ATTACKABLE`, `DIAGONAL_ATTACK_PATH` - already
 * alphabetical, so sorting is a no-op - but a flag declared out of order
 * would otherwise silently break the tag's required ordering. Consumers that
 * need flags in that order - the deviation query and `renderRulesetTag` -
 * iterate this array rather than re-deriving or re-asserting the order.
 */
export const RULE_FLAG_IDS: readonly RuleFlagId[] = (
  Object.keys(RULE_FLAG_CATALOG) as RuleFlagId[]
).sort();

/** The two kinds a flag can be classified as; see the module header comment. */
type RuleFlagKind = "game-defining" | "rule-choice";

/**
 * Classifies every flag id as exactly one kind. `as const satisfies` demands
 * an entry for every `RuleFlagId` (so a new flag fails to compile here until
 * it is classified) while keeping each entry's literal type, which is what
 * lets `GameDefiningFlagId`/`RuleChoiceFlagId` below extract the right ids at
 * the type level rather than just at runtime.
 */
const RULE_FLAG_KIND = {
  ARMY_COMPOSITION: "game-defining",
  BOARD_LAYOUT: "game-defining",
  DIAGONAL_ATTACKABLE: "rule-choice",
  DIAGONAL_ATTACK_PATH: "rule-choice",
} as const satisfies { readonly [Id in RuleFlagId]: RuleFlagKind };

/** The `RuleFlagId`s classified as `"game-defining"` by `RULE_FLAG_KIND`. */
export type GameDefiningFlagId = {
  readonly [
    Id in RuleFlagId
  ]: (typeof RULE_FLAG_KIND)[Id] extends "game-defining" ? Id : never;
}[RuleFlagId];

/** The `RuleFlagId`s classified as `"rule-choice"` by `RULE_FLAG_KIND`. */
export type RuleChoiceFlagId = {
  readonly [Id in RuleFlagId]: (typeof RULE_FLAG_KIND)[Id] extends "rule-choice"
    ? Id
    : never;
}[RuleFlagId];

function isGameDefiningFlagId(id: RuleFlagId): id is GameDefiningFlagId {
  return RULE_FLAG_KIND[id] === "game-defining";
}

function isRuleChoiceFlagId(id: RuleFlagId): id is RuleChoiceFlagId {
  return RULE_FLAG_KIND[id] === "rule-choice";
}

/**
 * The game-defining flag ids (`ARMY_COMPOSITION`, `BOARD_LAYOUT`), in
 * `RULE_FLAG_IDS` order. A player chooses these by choosing a game
 * (Battle/Skirmish/Clash) - see `games.ts` - never as a new-game-screen
 * toggle.
 */
export const GAME_DEFINING_FLAG_IDS: readonly GameDefiningFlagId[] =
  RULE_FLAG_IDS.filter(isGameDefiningFlagId);

/**
 * The rule-choice flag ids (today, the two diagonal flags), in
 * `RULE_FLAG_IDS` order. These are the flags `ruleChoices.ts` offers as
 * toggles and describes to a reviewer sentence by sentence.
 */
export const RULE_CHOICE_FLAG_IDS: readonly RuleChoiceFlagId[] =
  RULE_FLAG_IDS.filter(isRuleChoiceFlagId);

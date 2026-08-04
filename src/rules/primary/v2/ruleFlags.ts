// The flag catalog for ruleset major 2's two proposed diagonal-attack flags
// (story 00000027): `DIAGONAL_ATTACKABLE` and `DIAGONAL_ATTACK_PATH`.
//
// Neither is in `rules.md` Appendix A - both live in the companion
// capture-the-flag repository's `doc/ruleset/proposed-variants.md` sandbox
// (its story 00000039) and neither is implemented there. This app is the
// testing ground: a player picks each flag's value on the new-game screen,
// alongside the game (Battle/Skirmish) choice, and plays a real game under
// whatever they chose. See this story's implementation plan ("Grounding
// facts") for the source table.
//
// This module is the *only* place either flag's identifier or its value
// strings are spelled - a rename is a one-file edit (story.md: "flag
// identifiers may still change"). It defines the catalog only: resolving a
// flag's value for a given edition, and building the `RuleConfiguration` a
// game is actually set up, played, recorded and replayed under, lives in
// `configuration.ts`.

/**
 * The flag catalog: every flag this app knows, its permitted values and its
 * default. A third flag is a new entry here, nothing more - every type below
 * (`RuleFlagId`, `RuleFlagValue`, `ResolvedRuleFlags`) is derived from this
 * table, never restated.
 *
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

/** Identifies one of the two flags this app knows. */
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
 * `Object.keys(RULE_FLAG_CATALOG)` already yields `DIAGONAL_ATTACKABLE` then
 * `DIAGONAL_ATTACK_PATH`, so sorting is a no-op, but a third flag declared
 * out of order would otherwise silently break the tag's required ordering.
 * Consumers that need flags in that order - the deviation query and Step 2's
 * stamp renderer - iterate this array rather than re-deriving or
 * re-asserting the order.
 */
export const RULE_FLAG_IDS: readonly RuleFlagId[] = (
  Object.keys(RULE_FLAG_CATALOG) as RuleFlagId[]
).sort();

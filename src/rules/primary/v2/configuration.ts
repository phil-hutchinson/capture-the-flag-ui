// The rule configuration model for ruleset major 2 (story 00000027): an
// `Edition` plus a fully resolved value for every rule flag `ruleFlags.ts`
// knows.
//
// This is the app's first configuration that is not simply a registered
// `Edition` - a game is now set up, played, recorded and replayed under a
// `RuleConfiguration`, in place of a bare `Edition` (story 00000027's
// implementation plan, Decision 1). Nothing outside `ruleFlags.ts` and this
// module knows a flag's identifier or value strings.
//
// A `RuleConfiguration` is only ever built through `configureRules` below,
// which resolves every flag before storing it - so a non-canonical
// configuration (one that could redundantly restate a flag at its resolved
// value) is unrepresentable. Deviations are *derived*, never stored: see
// `deviatingFlags`. This step introduces the model only; rendering and
// parsing the `Ruleset` tag is Step 2, and nothing yet threads a
// `RuleConfiguration` into the rule engine, game state or the app (Step 3).

import { BATTLE_EDITION, SKIRMISH_EDITION, type Edition } from "./edition.ts";
import {
  RULE_FLAG_CATALOG,
  RULE_FLAG_IDS,
  type ResolvedRuleFlags,
  type RuleFlagId,
} from "./ruleFlags.ts";

/**
 * What a game is set up, played, recorded and replayed under: a registered
 * `Edition` plus every rule flag's fully resolved value. Both fields are
 * plain, JSON-serializable data - no functions or `Map`s - so a
 * configuration can cross the `PlayState`/`searchWorker.ts` boundary once
 * Step 3 threads it there.
 */
export interface RuleConfiguration {
  readonly edition: Edition;
  readonly flags: ResolvedRuleFlags;
}

/**
 * Chosen values for zero or more flags, to be resolved against an edition by
 * `configureRules`. A flag absent here resolves to the edition's own value
 * (Decision 2: none of today's editions state one) or, failing that, the
 * flag's own default.
 */
export type RuleFlagOverrides = {
  readonly [Id in RuleFlagId]?: ResolvedRuleFlags[Id];
};

/**
 * Resolves `flagId`'s value for `edition`, absent any override chosen by a
 * caller of `configureRules`: the edition's own stated value if it has one,
 * otherwise the flag's own default (story.md's "Decisions resolved at plan
 * time", Decision 2). No registered `Edition` states a value for either
 * flag today, so this always yields the flag's default at present - but
 * this function is the single extension point for the day an edition does
 * state one (e.g. by reading a flag-value field this function would gain on
 * `Edition`, checked before falling back to the catalog default below).
 */
function resolvedEditionValue<Id extends RuleFlagId>(
  edition: Edition,
  flagId: Id,
): ResolvedRuleFlags[Id] {
  void edition;
  return RULE_FLAG_CATALOG[flagId].default as ResolvedRuleFlags[Id];
}

/**
 * Builds a canonical `RuleConfiguration`: `edition` plus every flag resolved
 * to `overrides`' chosen value where given, and to `resolvedEditionValue`
 * otherwise. The only constructor - a `RuleConfiguration` cannot be built
 * any other way, so every configuration in the app is canonical by
 * construction, and comparing a flag's resolved value against
 * `resolvedEditionValue` (see `deviatingFlags`) is always a meaningful
 * "does this deviate" test.
 */
export function configureRules(
  edition: Edition,
  overrides: RuleFlagOverrides = {},
): RuleConfiguration {
  const flags = {} as Record<RuleFlagId, ResolvedRuleFlags[RuleFlagId]>;
  for (const flagId of RULE_FLAG_IDS) {
    flags[flagId] = overrides[flagId] ?? resolvedEditionValue(edition, flagId);
  }
  return {
    edition,
    flags: Object.freeze(flags) as ResolvedRuleFlags,
  };
}

/**
 * The flag ids whose resolved value in `configuration` differs from what
 * `configuration.edition` would resolve on its own (i.e. with no override
 * chosen) - what the `Ruleset` tag's `FLAG=value` tokens name (Step 2) and
 * what a player is told deviates from the standard game (Step 7). Always in
 * `RULE_FLAG_IDS` order, which is already alphabetical by flag id.
 */
export function deviatingFlags(
  configuration: RuleConfiguration,
): readonly RuleFlagId[] {
  return RULE_FLAG_IDS.filter(
    (flagId) =>
      configuration.flags[flagId] !==
      resolvedEditionValue(configuration.edition, flagId),
  );
}

/** True if `configuration` deviates from its edition on no flag at all. */
export function isStandardConfiguration(
  configuration: RuleConfiguration,
): boolean {
  return deviatingFlags(configuration).length === 0;
}

/**
 * The standard Battle configuration - `BATTLE_EDITION` with every flag at
 * its resolved (today, default) value. One spelling for fixtures and
 * consumers to use, mirroring `edition.ts`'s `BATTLE_EDITION` precedent.
 */
export const STANDARD_BATTLE_CONFIGURATION: RuleConfiguration =
  configureRules(BATTLE_EDITION);

/**
 * The standard Skirmish configuration - `SKIRMISH_EDITION` with every flag
 * at its resolved (today, default) value. One spelling for fixtures and
 * consumers to use, mirroring `edition.ts`'s `SKIRMISH_EDITION` precedent.
 */
export const STANDARD_SKIRMISH_CONFIGURATION: RuleConfiguration =
  configureRules(SKIRMISH_EDITION);

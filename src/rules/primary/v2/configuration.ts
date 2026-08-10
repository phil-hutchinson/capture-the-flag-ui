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
// `deviatingFlags`. `renderRulesetTag`/`parseRuleFlagTokens` (Step 2) are the
// two pure halves of the `Ruleset` tag's stamp - rendering a configuration to
// its tag string, and parsing the tag's flag tokens (the edition id is the
// caller's to consume; see `readRecord.ts`) back into a canonical
// configuration.
//
// `parseRuleFlagTokens` never rejects a tag's flag tokens (story 00000027,
// Step 10, correcting a Step 6 defect): a token it cannot resolve is carried
// as an *unrecognized* token, verbatim, rather than failing the whole
// record. The companion project's `technical-notes.md` guarantees view-only
// replay "for every record ever written, under any edition" by
// notation-schema stability alone, "no rules knowledge required" - a flag
// this app has never heard of is exactly a case that guarantee covers, and
// only the *edition* id (which the board layout and notation frame actually
// depend on) may still reject a record. See `readRecord.ts` for how the
// edition id and these tokens are split, and `src/review/reviewText.ts` /
// `src/board/ruleChoices.ts` for how an unrecognized token is described to a
// reviewer instead of hidden or refused.

import { ARMY_COMPOSITIONS, type ArmyRoster } from "./armyComposition.ts";
import { BOARD_LAYOUTS, type BoardLayout } from "./boardLayout.ts";
import { BATTLE_EDITION, SKIRMISH_EDITION, type Edition } from "./edition.ts";
import {
  RULE_FLAG_CATALOG,
  RULE_FLAG_IDS,
  type ResolvedRuleFlags,
  type RuleFlagId,
  type RuleFlagValue,
} from "./ruleFlags.ts";

/** True if `value` is one of `flagId`'s permitted values, per `RULE_FLAG_CATALOG`. */
function isPermittedValue<Id extends RuleFlagId>(
  flagId: Id,
  value: string,
): value is RuleFlagValue<Id> {
  const permitted: readonly string[] = RULE_FLAG_CATALOG[flagId].values;
  return permitted.includes(value);
}

/** True if `id` names one of `RULE_FLAG_IDS` (i.e. a flag this app knows). */
function isKnownFlagId(id: string): id is RuleFlagId {
  return (RULE_FLAG_IDS as readonly string[]).includes(id);
}

/**
 * The flag id a raw `Ruleset` tag token names, whether or not the token as a
 * whole is one this app could resolve: the text before its first `=`, or the
 * whole token if it has none. `parseRuleFlagTokens` above already does this
 * split internally but never surfaces it; this is exported for a caller that
 * needs to recognize a *specific* flag id among tokens this app could not
 * resolve at all (`ParsedRuleFlagTokens.unrecognizedTokens`) without
 * re-parsing anything about the token's value - story 00000030's Step 8:
 * `readRecord.ts` uses it to tell an unresolvable `BOARD_LAYOUT` token apart
 * from any other unrecognized token (Decision 8), and `ruleChoices.ts` uses
 * it again to give that one token its own sentence instead of the generic
 * unrecognized-token wording.
 */
export function rawTokenFlagId(token: string): string {
  const separatorIndex = token.indexOf("=");
  return separatorIndex === -1 ? token : token.slice(0, separatorIndex);
}

/**
 * What a game is set up, played, recorded and replayed under: a registered
 * `Edition` plus every rule flag's fully resolved value, plus the board and
 * army those flags resolve to. All fields are plain, JSON-serializable data -
 * no functions or `Map`s - so a configuration can cross the
 * `PlayState`/`searchWorker.ts` boundary.
 *
 * `boardLayout` and `army` (story 00000030's implementation plan, Decision 1)
 * are the resolved `BOARD_LAYOUT`/`ARMY_COMPOSITION` flag values looked up in
 * `BOARD_LAYOUTS`/`ARMY_COMPOSITIONS` - **not** `edition.boardLayoutId`/
 * `edition.armyCompositionId` read directly, because a configuration's board
 * and army are not always its edition's own (a Clash configuration names
 * `BATTLE_EDITION` as its edition but plays a different board and army
 * entirely). `Edition` itself carries no resolved board or roster any more:
 * these two fields on `RuleConfiguration` are the *only* place a board or a
 * roster comes from, for every rule path, every play surface and every
 * record. `configureRules` is the only place they are computed.
 */
export interface RuleConfiguration {
  readonly edition: Edition;
  readonly flags: ResolvedRuleFlags;
  readonly boardLayout: BoardLayout;
  readonly army: ArmyRoster;
}

/**
 * Chosen values for zero or more flags, to be resolved against an edition by
 * `configureRules`. A flag absent here resolves to the edition's own value if
 * it states one (`BOARD_LAYOUT` and `ARMY_COMPOSITION` always do; see
 * `resolvedEditionValue`) or, failing that, the flag's own default.
 */
export type RuleFlagOverrides = {
  readonly [Id in RuleFlagId]?: ResolvedRuleFlags[Id];
};

/**
 * Resolves `flagId`'s value for `edition`, absent any override chosen by a
 * caller of `configureRules`: the edition's own stated value if it has one,
 * otherwise the flag's own default (story.md's "Decisions resolved at plan
 * time", Decision 2).
 *
 * `BOARD_LAYOUT` and `ARMY_COMPOSITION` are the two flags every edition
 * *does* state a value for today - they are exactly `edition.boardLayoutId`
 * and `edition.armyCompositionId` (story 00000030's implementation plan,
 * Decision 3). Every other flag has no per-edition value, so it keeps
 * falling back to the catalog default. This is what keeps Battle's and
 * Skirmish's records byte-identical to before this story: each edition
 * resolves its own board and army, so neither ever deviates from itself and
 * neither ever emits a token - while a configuration naming a *different*
 * board or army than its edition's own (e.g. Clash, built on `BATTLE_EDITION`
 * with both flags overridden) now genuinely deviates on both.
 */
function resolvedEditionValue<Id extends RuleFlagId>(
  edition: Edition,
  flagId: Id,
): ResolvedRuleFlags[Id] {
  if (flagId === "BOARD_LAYOUT") {
    return edition.boardLayoutId as ResolvedRuleFlags[Id];
  }
  if (flagId === "ARMY_COMPOSITION") {
    return edition.armyCompositionId as ResolvedRuleFlags[Id];
  }
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
  const resolvedFlags = Object.freeze(flags) as ResolvedRuleFlags;
  return {
    edition,
    flags: resolvedFlags,
    boardLayout: BOARD_LAYOUTS[resolvedFlags.BOARD_LAYOUT],
    army: ARMY_COMPOSITIONS[resolvedFlags.ARMY_COMPOSITION].roster,
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

/**
 * True if `configuration` deviates from its edition on no flag at all.
 *
 * Unlike `nonStandardRuleSentences` (`ruleChoices.ts`), this predicate does
 * **not** apply Decision 5's game-defining-flag filter: it treats
 * `ARMY_COMPOSITION`/`BOARD_LAYOUT` exactly like any other flag, so a Clash
 * configuration - which deviates from `BATTLE_EDITION` on both of those by
 * design (story.md's "messy stamp" policy) - is deliberately reported as
 * non-standard here, even though a player never sees Clash described that
 * way (peer review #5, story 00000030).
 */
export function isStandardConfiguration(
  configuration: RuleConfiguration,
): boolean {
  return deviatingFlags(configuration).length === 0;
}

/**
 * Renders `configuration` as the `Ruleset` tag's value: the edition id,
 * followed by one `FLAG=value` token per deviating flag (in
 * `deviatingFlags`' - i.e. `RULE_FLAG_IDS`' - alphabetical order), space
 * separated. A standard configuration - the only case every registered
 * edition produces today - renders as exactly the bare edition id, with no
 * trailing space and no tokens, byte-identical to what this app has always
 * written (story.md, "the tag is byte-identical to what the app writes
 * today"). `parseRuleFlagTokens` below is this function's inverse.
 */
export function renderRulesetTag(configuration: RuleConfiguration): string {
  const tokens = deviatingFlags(configuration).map(
    (flagId) => `${flagId}=${configuration.flags[flagId]}`,
  );
  return [configuration.edition.id, ...tokens].join(" ");
}

/**
 * The result of `parseRuleFlagTokens` (story 00000027, Step 10): a canonical
 * `RuleConfiguration` built from every token this app could resolve, plus
 * the verbatim text of every token it could not - one entry per unresolved
 * token, in the order it appeared. Parsing a `Ruleset` tag's flag tokens
 * never fails; `readRecord.ts`'s only remaining rejection is an unknown
 * *edition* id (the token before these), per `technical-notes.md`'s
 * view-only-replay guarantee - see this module's header comment.
 */
export interface ParsedRuleFlagTokens {
  readonly configuration: RuleConfiguration;
  readonly unrecognizedTokens: readonly string[];
  /**
   * The flag ids whose resolved value in `configuration` came from an
   * explicit token in this call, as opposed to `edition`'s own value or the
   * flag's catalog default (story 00000030's peer review #2). A flag id can
   * appear here even when a *later* token naming the same id was rejected as
   * an unrecognized conflicting duplicate - the flag still genuinely
   * resolved, from the earlier token, so `readRecord.ts` uses this (rather
   * than `unrecognizedTokens` alone) to tell a flag that truly never
   * resolved from one that resolved and was merely *also* named again badly.
   */
  readonly resolvedFromToken: readonly RuleFlagId[];
}

/**
 * Parses the tokens that follow a `Ruleset` tag's edition id - already split
 * on whitespace by the caller - against `edition`, resolving every token it
 * can and carrying every token it cannot as an unrecognized token, verbatim.
 * `tokens` may be empty, which resolves to `edition`'s standard
 * configuration with no unrecognized tokens.
 *
 * A token resolves when, and only when, it is exactly one `NAME=value` pair
 * naming a flag id this app knows, a value that flag id permits, and either a
 * flag id not already resolved by an earlier token in this same call, or a
 * repeat of the *same* flag id and value an earlier token already resolved -
 * matching is exact and case-sensitive throughout (the writer only ever
 * emits the canonical spelling, `RULE_FLAG_CATALOG`'s). Everything else - a
 * malformed token, an unknown flag id, an unknown value for a known flag id,
 * or a second token naming a flag id an earlier token already resolved to a
 * *different* value - is carried in `unrecognizedTokens` instead, verbatim,
 * and does not affect the configuration at all (the flag it would have
 * named, if any, keeps whatever an earlier token or the edition's own
 * resolution already gave it).
 *
 * **Repeated flag id (peer review #1, owner decision).** An exact duplicate
 * - the same flag id and the same value as an earlier token in this call -
 * is absorbed silently: it changes nothing and is not reported, exactly the
 * canonicalization this function already performs for a flag redundantly
 * named at its resolved value (see below). A repeat naming a *different*
 * value for a flag id an earlier token already resolved keeps today's
 * behaviour exactly: the first token wins and the second, conflicting token
 * is carried as unrecognized - a design call, not a spec requirement, since
 * nothing says which of two conflicting tokens for one flag should win; open
 * to challenge at peer review.
 *
 * A token naming a flag at the value it would resolve to anyway is resolved
 * and absorbed exactly like any other override - `configureRules` resolves
 * every flag the same way regardless of whether its value came from an
 * override or a default, so the returned configuration reports no deviation
 * for it (story.md's canonicalization property: such a stamp means the same
 * as one that omits the token). This function is `renderRulesetTag`'s
 * inverse for every tag that function can produce, and additionally accepts
 * every canonicalizable tag `renderRulesetTag` never would.
 */
export function parseRuleFlagTokens(
  edition: Edition,
  tokens: readonly string[],
): ParsedRuleFlagTokens {
  const overrides: Partial<Record<RuleFlagId, ResolvedRuleFlags[RuleFlagId]>> =
    {};
  const unrecognizedTokens: string[] = [];

  for (const token of tokens) {
    const parts = token.split("=");
    if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
      unrecognizedTokens.push(token);
      continue;
    }

    const [flagId, value] = parts;
    if (!isKnownFlagId(flagId) || !isPermittedValue(flagId, value)) {
      unrecognizedTokens.push(token);
      continue;
    }

    if (Object.hasOwn(overrides, flagId)) {
      // Repeated flag id (peer review #1, owner decision: absorb exact
      // duplicates only). A repeat naming the *same* value as the
      // already-resolved one is the same canonicalization this function
      // already performs for a flag at its resolved value - it changes
      // nothing and is silently absorbed, not reported. A repeat naming a
      // *different* value keeps today's behaviour exactly: the first token
      // already won, and this second, conflicting token is carried as
      // unrecognized (still a design call, not a spec requirement, since
      // nothing says which of two conflicting tokens for one flag should
      // win; open to challenge at peer review).
      if (overrides[flagId] !== value) {
        unrecognizedTokens.push(token);
      }
      continue;
    }

    overrides[flagId] = value;
  }

  return {
    configuration: configureRules(edition, overrides as RuleFlagOverrides),
    unrecognizedTokens,
    resolvedFromToken: Object.keys(overrides) as RuleFlagId[],
  };
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

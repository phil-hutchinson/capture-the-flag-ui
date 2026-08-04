// Player-facing wording for the two diagonal-attack rule choices (story
// 00000027, Step 7): the single home for their copy, per the implementation
// plan's Decision 7.
//
// `GameChoice.tsx` (Step 8) renders both choices from `RULE_CHOICES` below,
// and `HotSeatGame.tsx`'s post-choice announcement, `ReviewScreen.tsx` and
// `GameRecord.tsx` (Steps 8-9) all use `nonStandardRuleSentences` to say
// what, if anything, is non-standard about a `RuleConfiguration`. Nothing
// here names a flag id or a value token to a player - those stay internal
// vocabulary (`ruleFlags.ts`), never player-facing text - and there is no
// "experimental"/"variant" framing: the two choices read as ordinary game
// settings, matching the owner's decision at the plan gate (story.md,
// "Presented as plain options, with no 'experimental' framing").
//
// Owner decision at the plan gate: the word is "diagonal", never
// "corner-to-corner" - `rules.md` §4.3 and its glossary, themselves written
// for players, already say "diagonal", so a player who follows the link to
// the rulebook meets the same word.
//
// Mirrors `gameNames.ts`'s single-home-for-a-mapping precedent, and follows
// its "exhaustive per-id record" style: `RULE_CHOICE_COPY` below is typed so
// a third flag id, or a third value for an existing flag, fails to compile
// here until it has copy - it can never silently fall back to no wording.
// Pure text only, no React - unit-testable in this project's `node` Vitest
// environment.

import {
  deviatingFlags,
  type RuleConfiguration,
} from "../rules/primary/v2/configuration.ts";
import {
  RULE_FLAG_CATALOG,
  RULE_FLAG_IDS,
  type RuleFlagId,
  type RuleFlagValue,
} from "../rules/primary/v2/ruleFlags.ts";

/** One value's plain-language copy: a short label and a one-sentence description. */
export interface RuleChoiceOption {
  readonly label: string;
  readonly description: string;
}

/** One flag's copy: a short heading plus every one of its values' copy, keyed by value. */
interface RuleChoiceCopyEntry<Id extends RuleFlagId> {
  readonly heading: string;
  readonly options: { readonly [Value in RuleFlagValue<Id>]: RuleChoiceOption };
}

/**
 * Every flag's copy, keyed by flag id. Typed so this object must have
 * exactly one entry per `RuleFlagId`, and each entry's `options` must have
 * exactly one entry per that flag's `RuleFlagValue` - a third flag or a
 * third value added to `ruleFlags.ts`'s catalog fails to compile here until
 * it is given copy (`gameNames.ts`'s `GAME_NAME` precedent).
 */
type RuleChoiceCopy = { readonly [Id in RuleFlagId]: RuleChoiceCopyEntry<Id> };

const RULE_CHOICE_COPY: RuleChoiceCopy = {
  DIAGONAL_ATTACKABLE: {
    heading: "What a diagonal attack can hit",
    options: {
      movable_only: {
        label: "Numbered pieces only (standard)",
        description:
          "A piece can only strike a numbered enemy standing diagonally next to it. Towers and the flag have to be taken head-on.",
      },
      all: {
        label: "Any piece, flag included",
        description:
          "A piece can strike any enemy standing diagonally next to it, towers and the flag included — so the flag can be captured from a diagonal.",
      },
    },
  },
  DIAGONAL_ATTACK_PATH: {
    heading: "Whether a diagonal attack needs room",
    options: {
      always: {
        label: "No room needed (standard)",
        description:
          "A piece can always strike an enemy standing diagonally next to it.",
      },
      open_path: {
        label: "Room needed beside it",
        description:
          "A diagonal attack only works if at least one of the two squares beside it is empty and isn't a lake.",
      },
    },
  },
};

/**
 * The overall heading for the section holding both choices on the new-game
 * screen (Step 8) - the story's "Section heading: Diagonal attacks", kept
 * here alongside the rest of the choices' copy rather than hardcoded in the
 * component.
 */
export const RULE_CHOICES_HEADING = "Diagonal attacks";

/** One option's copy plus its raw flag value and whether it is the standard one. */
export interface RuleChoiceOptionDescriptor extends RuleChoiceOption {
  readonly value: string;
  readonly isStandard: boolean;
}

/** One flag's full choice, ready to render: a heading and its options, standard option first. */
export interface RuleChoiceDescriptor {
  readonly flagId: RuleFlagId;
  readonly heading: string;
  readonly options: readonly RuleChoiceOptionDescriptor[];
}

function buildRuleChoice(flagId: RuleFlagId): RuleChoiceDescriptor {
  const catalogEntry = RULE_FLAG_CATALOG[flagId];
  const copyEntry = RULE_CHOICE_COPY[flagId];
  // The single cast in this module: `flagId` here is a runtime value drawn
  // from `RULE_FLAG_IDS`, not a value-level-literal type parameter, so
  // TypeScript can no longer track which flag's value union it belongs to.
  // `RULE_CHOICE_COPY`'s own declaration above (not this function) is what
  // actually enforces that every value has copy.
  const options = copyEntry.options as Readonly<
    Record<string, RuleChoiceOption>
  >;
  return {
    flagId,
    heading: copyEntry.heading,
    options: catalogEntry.values.map((value) => ({
      value,
      isStandard: value === catalogEntry.default,
      ...options[value],
    })),
  };
}

/**
 * Both flags' choices, ready to render on the new-game screen (Step 8), in
 * `RULE_FLAG_IDS`' order (`DIAGONAL_ATTACKABLE` then `DIAGONAL_ATTACK_PATH`)
 * with each choice's standard option listed first.
 */
export const RULE_CHOICES: readonly RuleChoiceDescriptor[] =
  RULE_FLAG_IDS.map(buildRuleChoice);

/**
 * The sentence(s) describing what is non-standard about `configuration`, one
 * per deviating flag in alphabetical flag order (`deviatingFlags`' order),
 * reusing that value's own one-sentence description from `RULE_CHOICE_COPY`
 * so there is exactly one spelling of what each value means. Empty when
 * `configuration` is standard - callers (Steps 8-9) render nothing in that
 * case, so an existing standard game or record looks exactly as it always
 * has.
 */
export function nonStandardRuleSentences(
  configuration: RuleConfiguration,
): readonly string[] {
  return deviatingFlags(configuration).map((flagId) => {
    const value = configuration.flags[flagId];
    const options = RULE_CHOICE_COPY[flagId].options as Readonly<
      Record<string, RuleChoiceOption>
    >;
    return options[value].description;
  });
}

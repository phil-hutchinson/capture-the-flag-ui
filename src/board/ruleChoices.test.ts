import { describe, expect, it } from "vitest";
import {
  configureRules,
  STANDARD_BATTLE_CONFIGURATION,
  STANDARD_SKIRMISH_CONFIGURATION,
} from "../rules/primary/v2/configuration.ts";
import { SUPERSEDED_SKIRMISH_EDITION } from "../rules/primary/v2/edition.ts";
import { RULE_FLAG_IDS } from "../rules/primary/v2/ruleFlags.ts";
import {
  nonStandardRuleSentences,
  RULE_CHOICES,
  RULE_CHOICES_HEADING,
  unrecognizedRuleSentence,
} from "./ruleChoices.ts";

describe("RULE_CHOICES", () => {
  it("has exactly one choice per known flag, in RULE_FLAG_IDS order", () => {
    expect(RULE_CHOICES.map((choice) => choice.flagId)).toEqual(RULE_FLAG_IDS);
  });

  it("gives every choice a non-empty heading", () => {
    for (const choice of RULE_CHOICES) {
      expect(choice.heading.length).toBeGreaterThan(0);
    }
  });

  it("gives every value a non-empty label and a non-empty one-sentence description", () => {
    for (const choice of RULE_CHOICES) {
      for (const option of choice.options) {
        expect(option.label.length).toBeGreaterThan(0);
        expect(option.description.length).toBeGreaterThan(0);
      }
    }
  });

  it("has exactly two options per choice, and marks exactly one of them standard", () => {
    for (const choice of RULE_CHOICES) {
      expect(choice.options).toHaveLength(2);
      expect(choice.options.filter((option) => option.isStandard)).toHaveLength(
        1,
      );
    }
  });

  it("lists the standard option first for each choice", () => {
    for (const choice of RULE_CHOICES) {
      expect(choice.options[0]?.isStandard).toBe(true);
    }
  });

  // Deliberately no test that the standard option's label says "standard":
  // the owner's decision at Step 8's manual gate is that no value is marked
  // as preferred while both flags are pre-release proposals. `isStandard`
  // survives as structure (it orders the options and derives the deviation
  // sentences), but it never reaches a player as a recommendation. See
  // `ruleChoices.ts`.

  it("has a non-empty overall section heading", () => {
    expect(RULE_CHOICES_HEADING.length).toBeGreaterThan(0);
  });
});

describe("nonStandardRuleSentences", () => {
  it("is empty for a standard configuration of each registered edition", () => {
    expect(nonStandardRuleSentences(STANDARD_BATTLE_CONFIGURATION)).toEqual([]);
    expect(nonStandardRuleSentences(STANDARD_SKIRMISH_CONFIGURATION)).toEqual(
      [],
    );
    expect(
      nonStandardRuleSentences(configureRules(SUPERSEDED_SKIRMISH_EDITION)),
    ).toEqual([]);
  });

  it("names exactly one sentence when only DIAGONAL_ATTACKABLE deviates", () => {
    const configuration = configureRules(
      STANDARD_BATTLE_CONFIGURATION.edition,
      { DIAGONAL_ATTACKABLE: "all" },
    );
    const sentences = nonStandardRuleSentences(configuration);
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toBe(
      RULE_CHOICES.find(
        (choice) => choice.flagId === "DIAGONAL_ATTACKABLE",
      )?.options.find((option) => option.value === "all")?.description,
    );
  });

  it("names exactly one sentence when only DIAGONAL_ATTACK_PATH deviates", () => {
    const configuration = configureRules(
      STANDARD_BATTLE_CONFIGURATION.edition,
      { DIAGONAL_ATTACK_PATH: "open_path" },
    );
    const sentences = nonStandardRuleSentences(configuration);
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toBe(
      RULE_CHOICES.find(
        (choice) => choice.flagId === "DIAGONAL_ATTACK_PATH",
      )?.options.find((option) => option.value === "open_path")?.description,
    );
  });

  it("names both sentences, in alphabetical flag order, when both deviate", () => {
    const configuration = configureRules(
      STANDARD_BATTLE_CONFIGURATION.edition,
      { DIAGONAL_ATTACKABLE: "all", DIAGONAL_ATTACK_PATH: "open_path" },
    );
    const sentences = nonStandardRuleSentences(configuration);
    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toContain("diagonal");
    expect(sentences[1]).toContain("diagonal");
    expect(sentences[0]).not.toBe(sentences[1]);
    // Alphabetical flag order: DIAGONAL_ATTACKABLE's sentence before
    // DIAGONAL_ATTACK_PATH's - matches each choice's own copy above.
    const attackableSentence = RULE_CHOICES.find(
      (choice) => choice.flagId === "DIAGONAL_ATTACKABLE",
    )?.options.find((option) => option.value === "all")?.description;
    const pathSentence = RULE_CHOICES.find(
      (choice) => choice.flagId === "DIAGONAL_ATTACK_PATH",
    )?.options.find((option) => option.value === "open_path")?.description;
    expect(sentences).toEqual([attackableSentence, pathSentence]);
  });
});

// Story 00000027, Step 10: describes a `Ruleset` tag token this app cannot
// resolve at all, quoting it back verbatim - unlike the rest of this
// module's copy, this one *does* embed the token's own text by design (see
// `ruleChoices.ts`'s header comment).
describe("unrecognizedRuleSentence", () => {
  it("quotes the exact token back, verbatim", () => {
    const sentence = unrecognizedRuleSentence("DIAGONAL_SOMETHING=on", false);
    expect(sentence).toContain("DIAGONAL_SOMETHING=on");
  });

  it("says nothing about the game being able to resume, and uses no 'experimental' framing", () => {
    const sentence = unrecognizedRuleSentence(
      "DIAGONAL_ATTACKABLE=sideways",
      false,
    );
    expect(sentence.toLowerCase()).not.toContain("resume");
    expect(sentence.toLowerCase()).not.toContain("experimental");
  });

  it("never says 'ply'", () => {
    expect(unrecognizedRuleSentence("FOO=bar", false)).not.toMatch(/\bply\b/i);
  });

  // Peer review #5, owner decision: "also" is conditional on whether this
  // sentence follows a recognised-deviation sentence, and nothing else about
  // the sentence changes either way.
  it("drops 'also' when the sentence stands alone", () => {
    const sentence = unrecognizedRuleSentence("FOO=bar", false);
    expect(sentence).toBe(
      `This game used a rule setting this app doesn't recognize ("FOO=bar"). The game can still be reviewed.`,
    );
  });

  it("keeps 'also' when the sentence follows a recognised-deviation sentence", () => {
    const sentence = unrecognizedRuleSentence("FOO=bar", true);
    expect(sentence).toBe(
      `This game also used a rule setting this app doesn't recognize ("FOO=bar"). The game can still be reviewed.`,
    );
  });
});

describe("no jargon leaks into player-facing copy", () => {
  // Flag identifiers and value tokens are internal vocabulary
  // (`ruleFlags.ts`) that must never reach a player (story.md: "Flag
  // identifiers and value labels are never shown to a player"). "all" and
  // "always" are deliberately *not* checked here even though they are two of
  // the four value tokens - both are ordinary English words the plain-copy
  // sentences legitimately use (e.g. "A piece can always strike..."), so
  // checking for them as bare substrings would fail on prose that has
  // nothing to do with the internal token spelling. The unambiguous,
  // snake_case-only tokens below can never appear in ordinary English text.
  const forbiddenSubstrings = [
    "DIAGONAL_ATTACKABLE",
    "DIAGONAL_ATTACK_PATH",
    "movable_only",
    "open_path",
    "edition",
    "Edition",
    "2-0:BATTLE",
    "2-1:SKIRMISH",
    "2-0:SKIRMISH",
  ];

  function allPlayerFacingStrings(): readonly string[] {
    const strings: string[] = [RULE_CHOICES_HEADING];
    for (const choice of RULE_CHOICES) {
      strings.push(choice.heading);
      for (const option of choice.options) {
        strings.push(option.label, option.description);
      }
    }
    strings.push(
      ...nonStandardRuleSentences(
        configureRules(STANDARD_BATTLE_CONFIGURATION.edition, {
          DIAGONAL_ATTACKABLE: "all",
          DIAGONAL_ATTACK_PATH: "open_path",
        }),
      ),
    );
    return strings;
  }

  it("contains no flag id, value token, 'edition', or edition id", () => {
    for (const text of allPlayerFacingStrings()) {
      for (const forbidden of forbiddenSubstrings) {
        expect(text).not.toContain(forbidden);
      }
    }
  });

  it("never says 'ply' (player-facing text says 'move')", () => {
    for (const text of allPlayerFacingStrings()) {
      expect(text).not.toMatch(/\bply\b/i);
    }
  });
});

import { describe, expect, it } from "vitest";
import { ARMY_COMPOSITIONS } from "./armyComposition.ts";
import { BOARD_LAYOUTS } from "./boardLayout.ts";
import {
  configureRules,
  deviatingFlags,
  isStandardConfiguration,
  parseRuleFlagTokens,
  renderRulesetTag,
  STANDARD_BATTLE_CONFIGURATION,
  STANDARD_SKIRMISH_CONFIGURATION,
} from "./configuration.ts";
import {
  BATTLE_EDITION,
  editionById,
  SKIRMISH_EDITION,
  SUPERSEDED_SKIRMISH_EDITION,
} from "./edition.ts";
import {
  GAME_DEFINING_FLAG_IDS,
  RULE_CHOICE_FLAG_IDS,
  RULE_FLAG_CATALOG,
  RULE_FLAG_IDS,
  type DiagonalAttackableValue,
  type DiagonalAttackPathValue,
} from "./ruleFlags.ts";

describe("the flag catalog (ruleFlags.ts)", () => {
  it("covers exactly the four known flag ids, alphabetically", () => {
    expect(RULE_FLAG_IDS).toEqual([
      "ARMY_COMPOSITION",
      "BOARD_LAYOUT",
      "DIAGONAL_ATTACKABLE",
      "DIAGONAL_ATTACK_PATH",
    ]);
  });

  // Peer review #4: pins the alphabetical-ordering invariant structurally,
  // so a flag id declared out of catalog order can't silently break the
  // `Ruleset` tag's required alphabetical ordering.
  it("is alphabetically sorted", () => {
    expect(RULE_FLAG_IDS).toEqual([...RULE_FLAG_IDS].sort());
  });

  it("ARMY_COMPOSITION permits exactly standard_battle, standard_skirmish and standard_clash, defaulting to standard_battle", () => {
    expect(RULE_FLAG_CATALOG.ARMY_COMPOSITION.values).toEqual([
      "standard_battle",
      "standard_skirmish",
      "standard_clash",
    ]);
    expect(RULE_FLAG_CATALOG.ARMY_COMPOSITION.default).toBe("standard_battle");
  });

  it("BOARD_LAYOUT permits exactly standard_144, standard_64 and asymmetric_100, defaulting to standard_144", () => {
    expect(RULE_FLAG_CATALOG.BOARD_LAYOUT.values).toEqual([
      "standard_144",
      "standard_64",
      "asymmetric_100",
    ]);
    expect(RULE_FLAG_CATALOG.BOARD_LAYOUT.default).toBe("standard_144");
  });

  it("DIAGONAL_ATTACKABLE permits exactly movable_only and all, defaulting to movable_only", () => {
    expect(RULE_FLAG_CATALOG.DIAGONAL_ATTACKABLE.values).toEqual([
      "movable_only",
      "all",
    ]);
    expect(RULE_FLAG_CATALOG.DIAGONAL_ATTACKABLE.default).toBe("movable_only");
  });

  it("DIAGONAL_ATTACK_PATH permits exactly always and open_path, defaulting to always", () => {
    expect(RULE_FLAG_CATALOG.DIAGONAL_ATTACK_PATH.values).toEqual([
      "always",
      "open_path",
    ]);
    expect(RULE_FLAG_CATALOG.DIAGONAL_ATTACK_PATH.default).toBe("always");
  });
});

describe("game-defining vs. rule-choice flag classification", () => {
  it("partitions RULE_FLAG_IDS into exactly the game-defining and rule-choice lists", () => {
    const merged = [...GAME_DEFINING_FLAG_IDS, ...RULE_CHOICE_FLAG_IDS].sort();
    expect(merged).toEqual([...RULE_FLAG_IDS].sort());
    // No overlap, and every id is classified.
    expect(GAME_DEFINING_FLAG_IDS.length + RULE_CHOICE_FLAG_IDS.length).toBe(
      RULE_FLAG_IDS.length,
    );
  });

  it("classifies ARMY_COMPOSITION and BOARD_LAYOUT as game-defining", () => {
    expect(GAME_DEFINING_FLAG_IDS).toEqual([
      "ARMY_COMPOSITION",
      "BOARD_LAYOUT",
    ]);
  });

  it("classifies the two diagonal flags as rule choices", () => {
    expect(RULE_CHOICE_FLAG_IDS).toEqual([
      "DIAGONAL_ATTACKABLE",
      "DIAGONAL_ATTACK_PATH",
    ]);
  });
});

describe("configureRules (standard configurations)", () => {
  it.each([
    ["2-0:BATTLE", BATTLE_EDITION],
    ["2-1:SKIRMISH", SKIRMISH_EDITION],
    ["2-0:SKIRMISH", SUPERSEDED_SKIRMISH_EDITION],
  ] as const)(
    "%s resolves both flags to their defaults and reports no deviations",
    (_id, edition) => {
      const configuration = configureRules(edition);

      expect(configuration.flags.DIAGONAL_ATTACKABLE).toBe("movable_only");
      expect(configuration.flags.DIAGONAL_ATTACK_PATH).toBe("always");
      expect(deviatingFlags(configuration)).toEqual([]);
      expect(isStandardConfiguration(configuration)).toBe(true);
    },
  );

  it("carries the edition it was built from", () => {
    const configuration = configureRules(BATTLE_EDITION);
    expect(configuration.edition).toBe(BATTLE_EDITION);
  });

  // Story 00000030, implementation plan Decision 3: `resolvedEditionValue`
  // resolves `BOARD_LAYOUT`/`ARMY_COMPOSITION` from the edition's own ids,
  // for every registered edition - not only the two active ones - so a
  // standard configuration on any of them still reports no deviation and
  // still renders byte-identically to its bare edition id.
  it.each([
    ["2-0:BATTLE", BATTLE_EDITION, "standard_144", "standard_battle"],
    ["2-1:SKIRMISH", SKIRMISH_EDITION, "standard_64", "standard_skirmish"],
    [
      "2-0:SKIRMISH",
      SUPERSEDED_SKIRMISH_EDITION,
      "standard_64",
      "standard_skirmish",
    ],
  ] as const)(
    "%s resolves BOARD_LAYOUT and ARMY_COMPOSITION to its own ids and reports no deviation",
    (id, edition, boardLayoutId, armyCompositionId) => {
      const configuration = configureRules(edition);

      expect(configuration.flags.BOARD_LAYOUT).toBe(boardLayoutId);
      expect(configuration.flags.ARMY_COMPOSITION).toBe(armyCompositionId);
      expect(deviatingFlags(configuration)).toEqual([]);
      expect(isStandardConfiguration(configuration)).toBe(true);
      expect(renderRulesetTag(configuration)).toBe(id);
    },
  );

  // Story 00000030's implementation plan, Decision 1: `Edition` no longer
  // carries a resolved board or roster at all - `RuleConfiguration.boardLayout`
  // / `.army` (looked up from the same resolved `BOARD_LAYOUT`/
  // `ARMY_COMPOSITION` flag values `resolvedEditionValue` derives from the
  // edition's own ids) are the *only* place a board or a roster comes from.
  // These assertions moved here from `edition.test.ts`, which no longer has
  // anything to assert about a board or roster living on the edition itself.
  it.each([
    ["2-0:BATTLE", BATTLE_EDITION, "standard_144", "standard_battle"],
    ["2-1:SKIRMISH", SKIRMISH_EDITION, "standard_64", "standard_skirmish"],
    [
      "2-0:SKIRMISH",
      SUPERSEDED_SKIRMISH_EDITION,
      "standard_64",
      "standard_skirmish",
    ],
  ] as const)(
    "%s resolves its own board layout and army roster",
    (_id, edition, boardLayoutId, armyCompositionId) => {
      const configuration = configureRules(edition);

      expect(configuration.boardLayout).toBe(BOARD_LAYOUTS[boardLayoutId]);
      expect(configuration.army).toBe(
        ARMY_COMPOSITIONS[armyCompositionId].roster,
      );
    },
  );
});

describe("configureRules (deviations)", () => {
  it("choosing a non-default value for one flag deviates only that flag", () => {
    const configuration = configureRules(BATTLE_EDITION, {
      DIAGONAL_ATTACKABLE: "all",
    });

    expect(configuration.flags.DIAGONAL_ATTACKABLE).toBe("all");
    expect(configuration.flags.DIAGONAL_ATTACK_PATH).toBe("always");
    expect(deviatingFlags(configuration)).toEqual(["DIAGONAL_ATTACKABLE"]);
    expect(isStandardConfiguration(configuration)).toBe(false);
  });

  it("choosing a non-default value for the other flag deviates only that flag", () => {
    const configuration = configureRules(SKIRMISH_EDITION, {
      DIAGONAL_ATTACK_PATH: "open_path",
    });

    expect(configuration.flags.DIAGONAL_ATTACKABLE).toBe("movable_only");
    expect(configuration.flags.DIAGONAL_ATTACK_PATH).toBe("open_path");
    expect(deviatingFlags(configuration)).toEqual(["DIAGONAL_ATTACK_PATH"]);
  });

  it("choosing a value equal to the resolved value produces no deviation (canonicalization)", () => {
    const configuration = configureRules(BATTLE_EDITION, {
      DIAGONAL_ATTACKABLE: "movable_only",
    });

    expect(deviatingFlags(configuration)).toEqual([]);
    expect(isStandardConfiguration(configuration)).toBe(true);
  });

  it("lists both deviating flags alphabetically by flag id when both deviate", () => {
    const configuration = configureRules(BATTLE_EDITION, {
      DIAGONAL_ATTACK_PATH: "open_path",
      DIAGONAL_ATTACKABLE: "all",
    });

    expect(deviatingFlags(configuration)).toEqual([
      "DIAGONAL_ATTACKABLE",
      "DIAGONAL_ATTACK_PATH",
    ]);
  });

  it("an omitted overrides argument behaves exactly as an empty one", () => {
    const withEmptyOverrides = configureRules(BATTLE_EDITION, {});
    const withNoOverrides = configureRules(BATTLE_EDITION);

    expect(withNoOverrides).toEqual(withEmptyOverrides);
  });
});

// Story 00000030: a Clash configuration is `BATTLE_EDITION` with both
// game-defining flags overridden to the Clash values - this app's first use
// of a deviating game-defining flag, and the shape every Clash game records
// under (this story's Policy: "Clash records as a deviation from Battle").
describe("configureRules (game-defining deviations, i.e. Clash)", () => {
  it("overriding both game-defining flags to the Clash values reports exactly those two deviations", () => {
    const configuration = configureRules(BATTLE_EDITION, {
      ARMY_COMPOSITION: "standard_clash",
      BOARD_LAYOUT: "asymmetric_100",
    });

    expect(configuration.flags.ARMY_COMPOSITION).toBe("standard_clash");
    expect(configuration.flags.BOARD_LAYOUT).toBe("asymmetric_100");
    expect(deviatingFlags(configuration)).toEqual([
      "ARMY_COMPOSITION",
      "BOARD_LAYOUT",
    ]);
    expect(isStandardConfiguration(configuration)).toBe(false);
    expect(renderRulesetTag(configuration)).toBe(
      "2-0:BATTLE ARMY_COMPOSITION=standard_clash BOARD_LAYOUT=asymmetric_100",
    );
    // The resolved board and army come from the *configuration*'s own
    // flags, not from `BATTLE_EDITION`'s - the whole point of story
    // 00000030's Decision 1. `configuration.edition` still names Battle
    // (the deliberately "messy" stamp), but `configuration.boardLayout`/
    // `.army` are Clash's.
    expect(configuration.boardLayout).toBe(BOARD_LAYOUTS.asymmetric_100);
    expect(configuration.army).toBe(ARMY_COMPOSITIONS.standard_clash.roster);
    expect(configuration.boardLayout).not.toBe(
      BOARD_LAYOUTS[BATTLE_EDITION.boardLayoutId],
    );
    expect(configuration.army).not.toBe(
      ARMY_COMPOSITIONS[BATTLE_EDITION.armyCompositionId].roster,
    );
  });

  it("adding a diagonal deviation on top of Clash appends its token after both game-defining tokens", () => {
    const configuration = configureRules(BATTLE_EDITION, {
      ARMY_COMPOSITION: "standard_clash",
      BOARD_LAYOUT: "asymmetric_100",
      DIAGONAL_ATTACKABLE: "all",
    });

    expect(deviatingFlags(configuration)).toEqual([
      "ARMY_COMPOSITION",
      "BOARD_LAYOUT",
      "DIAGONAL_ATTACKABLE",
    ]);
    expect(renderRulesetTag(configuration)).toBe(
      "2-0:BATTLE ARMY_COMPOSITION=standard_clash BOARD_LAYOUT=asymmetric_100 DIAGONAL_ATTACKABLE=all",
    );
  });

  it("overriding Skirmish's BOARD_LAYOUT to its own resolved value produces no deviation (canonicalization)", () => {
    const configuration = configureRules(SKIRMISH_EDITION, {
      BOARD_LAYOUT: "standard_64",
    });

    expect(deviatingFlags(configuration)).toEqual([]);
    expect(isStandardConfiguration(configuration)).toBe(true);
    expect(renderRulesetTag(configuration)).toBe("2-1:SKIRMISH");
  });
});

describe("STANDARD_BATTLE_CONFIGURATION and STANDARD_SKIRMISH_CONFIGURATION", () => {
  it("pair the active editions with every flag at its default", () => {
    expect(STANDARD_BATTLE_CONFIGURATION.edition).toBe(
      editionById("2-0:BATTLE"),
    );
    expect(STANDARD_SKIRMISH_CONFIGURATION.edition).toBe(
      editionById("2-1:SKIRMISH"),
    );
    expect(isStandardConfiguration(STANDARD_BATTLE_CONFIGURATION)).toBe(true);
    expect(isStandardConfiguration(STANDARD_SKIRMISH_CONFIGURATION)).toBe(true);
  });
});

describe("a RuleConfiguration is a plain, JSON-round-trippable object", () => {
  it("survives a JSON round trip unchanged", () => {
    const configuration = configureRules(SKIRMISH_EDITION, {
      DIAGONAL_ATTACKABLE: "all",
      DIAGONAL_ATTACK_PATH: "open_path",
    });

    const roundTripped = JSON.parse(JSON.stringify(configuration)) as unknown;
    expect(roundTripped).toEqual(configuration);
  });

  // Story 00000030's implementation plan, Step 4 verification: the resolved
  // `boardLayout`/`army` (plain data, no functions or `Map`s - Decision 1)
  // must survive the round trip intact too, including for a Clash-shaped
  // configuration whose board and army are not its edition's own.
  it("survives a JSON round trip with the resolved boardLayout and army intact (Clash-shaped configuration)", () => {
    const configuration = configureRules(BATTLE_EDITION, {
      ARMY_COMPOSITION: "standard_clash",
      BOARD_LAYOUT: "asymmetric_100",
    });

    const roundTripped = JSON.parse(
      JSON.stringify(configuration),
    ) as typeof configuration;
    expect(roundTripped.boardLayout).toEqual(configuration.boardLayout);
    expect(roundTripped.army).toEqual(configuration.army);
  });
});

describe("renderRulesetTag", () => {
  it.each([
    ["2-0:BATTLE", BATTLE_EDITION],
    ["2-1:SKIRMISH", SKIRMISH_EDITION],
    ["2-0:SKIRMISH", SUPERSEDED_SKIRMISH_EDITION],
  ] as const)(
    "renders a standard %s configuration byte-identically to its bare edition id",
    (id, edition) => {
      expect(renderRulesetTag(configureRules(edition))).toBe(id);
    },
  );

  it("renders a single DIAGONAL_ATTACKABLE deviation as one token", () => {
    const configuration = configureRules(BATTLE_EDITION, {
      DIAGONAL_ATTACKABLE: "all",
    });
    expect(renderRulesetTag(configuration)).toBe(
      "2-0:BATTLE DIAGONAL_ATTACKABLE=all",
    );
  });

  it("renders a single DIAGONAL_ATTACK_PATH deviation as one token", () => {
    const configuration = configureRules(SKIRMISH_EDITION, {
      DIAGONAL_ATTACK_PATH: "open_path",
    });
    expect(renderRulesetTag(configuration)).toBe(
      "2-1:SKIRMISH DIAGONAL_ATTACK_PATH=open_path",
    );
  });

  it("renders both deviations alphabetically by flag id (DIAGONAL_ATTACKABLE first)", () => {
    const configuration = configureRules(BATTLE_EDITION, {
      DIAGONAL_ATTACK_PATH: "open_path",
      DIAGONAL_ATTACKABLE: "all",
    });
    expect(renderRulesetTag(configuration)).toBe(
      "2-0:BATTLE DIAGONAL_ATTACKABLE=all DIAGONAL_ATTACK_PATH=open_path",
    );
  });
});

describe("parseRuleFlagTokens", () => {
  const attackableValues: readonly DiagonalAttackableValue[] = [
    "movable_only",
    "all",
  ];
  const pathValues: readonly DiagonalAttackPathValue[] = [
    "always",
    "open_path",
  ];
  const combinations = attackableValues.flatMap((attackable) =>
    pathValues.map(
      (path) =>
        [attackable, path] as [
          DiagonalAttackableValue,
          DiagonalAttackPathValue,
        ],
    ),
  );

  it("parsing no tokens gives the standard configuration, with no unrecognized tokens", () => {
    const battleResult = parseRuleFlagTokens(BATTLE_EDITION, []);
    expect(battleResult).toEqual({
      configuration: STANDARD_BATTLE_CONFIGURATION,
      unrecognizedTokens: [],
      resolvedFromToken: [],
    });

    const skirmishResult = parseRuleFlagTokens(SKIRMISH_EDITION, []);
    expect(skirmishResult).toEqual({
      configuration: STANDARD_SKIRMISH_CONFIGURATION,
      unrecognizedTokens: [],
      resolvedFromToken: [],
    });
  });

  it.each([
    ["2-0:BATTLE", BATTLE_EDITION],
    ["2-1:SKIRMISH", SKIRMISH_EDITION],
  ] as const)(
    "round-trips all four value combinations through render and parse on %s",
    (_id, edition) => {
      for (const [attackable, path] of combinations) {
        const configuration = configureRules(edition, {
          DIAGONAL_ATTACKABLE: attackable,
          DIAGONAL_ATTACK_PATH: path,
        });

        const rendered = renderRulesetTag(configuration);
        const [, ...tokens] = rendered.split(" ");
        const parsed = parseRuleFlagTokens(edition, tokens);

        expect(parsed).toEqual({
          configuration,
          unrecognizedTokens: [],
          resolvedFromToken: tokens.map((token) => token.split("=")[0]),
        });
        expect(renderRulesetTag(parsed.configuration)).toBe(rendered);
      }
    },
  );

  it("canonicalizes a token naming a flag at its resolved value: no deviation, and re-renders without it", () => {
    const result = parseRuleFlagTokens(BATTLE_EDITION, [
      "DIAGONAL_ATTACKABLE=movable_only",
    ]);

    expect(result.unrecognizedTokens).toEqual([]);
    expect(isStandardConfiguration(result.configuration)).toBe(true);
    expect(deviatingFlags(result.configuration)).toEqual([]);
    expect(renderRulesetTag(result.configuration)).toBe("2-0:BATTLE");
  });

  // Story 00000027, Step 10 (correcting a Step 6 defect): none of these four
  // token shapes fail parsing any more - `technical-notes.md`'s view-only
  // replay guarantee means only the edition id (consumed by the caller, see
  // `readRecord.ts`) may reject a record. Each unresolvable token is instead
  // carried back verbatim in `unrecognizedTokens`, and the configuration
  // resolves as if that token had been absent.
  it("carries a malformed token (not exactly one NAME=value pair) as unrecognized, leaving the configuration standard", () => {
    const cases = [
      "DIAGONAL_ATTACKABLE",
      "DIAGONAL_ATTACKABLE=",
      "=all",
      "A=B=C",
    ];
    for (const token of cases) {
      const result = parseRuleFlagTokens(BATTLE_EDITION, [token]);
      expect(result.unrecognizedTokens).toEqual([token]);
      expect(isStandardConfiguration(result.configuration)).toBe(true);
      // Peer review #2: a malformed token never resolves the flag it names
      // (if any) - the flag falls back to the edition/default entirely.
      expect(result.resolvedFromToken).toEqual([]);
    }
  });

  it("carries an unknown flag id as unrecognized", () => {
    const token = "DIAGONAL_TELEPORT=all";
    const result = parseRuleFlagTokens(BATTLE_EDITION, [token]);
    expect(result.unrecognizedTokens).toEqual([token]);
    expect(isStandardConfiguration(result.configuration)).toBe(true);
  });

  it("carries an unknown value for a known flag as unrecognized", () => {
    const token = "DIAGONAL_ATTACKABLE=everything";
    const result = parseRuleFlagTokens(BATTLE_EDITION, [token]);
    expect(result.unrecognizedTokens).toEqual([token]);
    expect(isStandardConfiguration(result.configuration)).toBe(true);
  });

  // Peer review #7: `overrides` is typed as a value union across *all*
  // flags and reaches `configureRules` through an `as RuleFlagOverrides`
  // cast, so cross-flag pairing is only enforced by `isPermittedValue` at
  // runtime - a value that is valid for the *other* flag must still be
  // rejected as unrecognized for the flag id it was actually given against.
  it("carries a value belonging to the other flag as unrecognized", () => {
    const token = "DIAGONAL_ATTACKABLE=open_path";
    const result = parseRuleFlagTokens(BATTLE_EDITION, [token]);
    expect(result.unrecognizedTokens).toEqual([token]);
    expect(isStandardConfiguration(result.configuration)).toBe(true);
  });

  it("is case-sensitive: a near-miss casing is carried as unrecognized, not accepted", () => {
    const token = "diagonal_attackable=all";
    const result = parseRuleFlagTokens(BATTLE_EDITION, [token]);
    expect(result.unrecognizedTokens).toEqual([token]);
    expect(isStandardConfiguration(result.configuration)).toBe(true);
  });

  it("resolves the same flag id given twice with conflicting values from its first token, carrying the second as unrecognized", () => {
    const secondToken = "DIAGONAL_ATTACKABLE=movable_only";
    const result = parseRuleFlagTokens(BATTLE_EDITION, [
      "DIAGONAL_ATTACKABLE=all",
      secondToken,
    ]);
    expect(result.configuration.flags.DIAGONAL_ATTACKABLE).toBe("all");
    expect(result.unrecognizedTokens).toEqual([secondToken]);
    // Peer review #2: the flag genuinely resolved, from the first token -
    // `resolvedFromToken` says so even though a later, conflicting token for
    // the same flag id was rejected. `readRecord.ts` relies on exactly this
    // to tell a flag that resolved (and was merely also named again badly)
    // apart from one that never resolved at all.
    expect(result.resolvedFromToken).toEqual(["DIAGONAL_ATTACKABLE"]);
  });

  // Peer review #1, owner decision: an exact duplicate (same flag id, same
  // value) is absorbed silently - it changes nothing and is not reported,
  // unlike a repeat naming a *different* value (above).
  it("absorbs an exact duplicate token silently: no deviation lost, and nothing reported as unrecognized", () => {
    const result = parseRuleFlagTokens(BATTLE_EDITION, [
      "DIAGONAL_ATTACKABLE=all",
      "DIAGONAL_ATTACKABLE=all",
    ]);
    expect(result.configuration.flags.DIAGONAL_ATTACKABLE).toBe("all");
    expect(deviatingFlags(result.configuration)).toEqual([
      "DIAGONAL_ATTACKABLE",
    ]);
    expect(result.unrecognizedTokens).toEqual([]);
  });

  it("mixes a recognized and an unrecognized token: the recognized one resolves, the other is carried as unrecognized", () => {
    const result = parseRuleFlagTokens(BATTLE_EDITION, [
      "DIAGONAL_ATTACKABLE=all",
      "DIAGONAL_SOMETHING=on",
    ]);
    expect(deviatingFlags(result.configuration)).toEqual([
      "DIAGONAL_ATTACKABLE",
    ]);
    expect(result.unrecognizedTokens).toEqual(["DIAGONAL_SOMETHING=on"]);
  });

  // Story 00000030: the Clash tag's two game-defining tokens round-trip
  // through render and parse exactly like the diagonal tokens above.
  it("round-trips the Clash tag's two game-defining tokens", () => {
    const configuration = configureRules(BATTLE_EDITION, {
      ARMY_COMPOSITION: "standard_clash",
      BOARD_LAYOUT: "asymmetric_100",
    });

    const rendered = renderRulesetTag(configuration);
    const [, ...tokens] = rendered.split(" ");
    const parsed = parseRuleFlagTokens(BATTLE_EDITION, tokens);

    expect(parsed).toEqual({
      configuration,
      unrecognizedTokens: [],
      resolvedFromToken: ["ARMY_COMPOSITION", "BOARD_LAYOUT"],
    });
    expect(renderRulesetTag(parsed.configuration)).toBe(rendered);
  });

  it("carries an unknown value for BOARD_LAYOUT as unrecognized, not a rejection", () => {
    const token = "BOARD_LAYOUT=huge_400";
    const result = parseRuleFlagTokens(BATTLE_EDITION, [token]);
    expect(result.unrecognizedTokens).toEqual([token]);
    expect(isStandardConfiguration(result.configuration)).toBe(true);
  });

  it("carries an unknown value for ARMY_COMPOSITION as unrecognized, not a rejection", () => {
    const token = "ARMY_COMPOSITION=huge_army";
    const result = parseRuleFlagTokens(BATTLE_EDITION, [token]);
    expect(result.unrecognizedTokens).toEqual([token]);
    expect(isStandardConfiguration(result.configuration)).toBe(true);
  });
});

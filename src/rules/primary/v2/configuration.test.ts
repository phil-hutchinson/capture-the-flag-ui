import { describe, expect, it } from "vitest";
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
  RULE_FLAG_CATALOG,
  RULE_FLAG_IDS,
  type DiagonalAttackableValue,
  type DiagonalAttackPathValue,
} from "./ruleFlags.ts";

describe("the flag catalog (ruleFlags.ts)", () => {
  it("covers exactly the two known flag ids", () => {
    expect(RULE_FLAG_IDS).toEqual([
      "DIAGONAL_ATTACKABLE",
      "DIAGONAL_ATTACK_PATH",
    ]);
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

  it("parsing no tokens gives the standard configuration", () => {
    const battleResult = parseRuleFlagTokens(BATTLE_EDITION, []);
    expect(battleResult).toEqual({
      kind: "parsed",
      configuration: STANDARD_BATTLE_CONFIGURATION,
    });

    const skirmishResult = parseRuleFlagTokens(SKIRMISH_EDITION, []);
    expect(skirmishResult).toEqual({
      kind: "parsed",
      configuration: STANDARD_SKIRMISH_CONFIGURATION,
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

        expect(parsed).toEqual({ kind: "parsed", configuration });
        if (parsed.kind === "parsed") {
          expect(renderRulesetTag(parsed.configuration)).toBe(rendered);
        }
      }
    },
  );

  it("canonicalizes a token naming a flag at its resolved value: no deviation, and re-renders without it", () => {
    const result = parseRuleFlagTokens(BATTLE_EDITION, [
      "DIAGONAL_ATTACKABLE=movable_only",
    ]);

    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") return;
    expect(isStandardConfiguration(result.configuration)).toBe(true);
    expect(deviatingFlags(result.configuration)).toEqual([]);
    expect(renderRulesetTag(result.configuration)).toBe("2-0:BATTLE");
  });

  it("rejects a malformed token (not exactly one NAME=value pair), naming it", () => {
    const cases = [
      "DIAGONAL_ATTACKABLE",
      "DIAGONAL_ATTACKABLE=",
      "=all",
      "A=B=C",
    ];
    for (const token of cases) {
      const result = parseRuleFlagTokens(BATTLE_EDITION, [token]);
      expect(result).toEqual({
        kind: "error",
        error: { kind: "malformedToken", token },
      });
    }
  });

  it("rejects an unknown flag id, naming the offending token", () => {
    const token = "DIAGONAL_TELEPORT=all";
    const result = parseRuleFlagTokens(BATTLE_EDITION, [token]);
    expect(result).toEqual({
      kind: "error",
      error: { kind: "unknownFlagId", token },
    });
  });

  it("rejects an unknown value for a known flag, naming the offending token", () => {
    const token = "DIAGONAL_ATTACKABLE=everything";
    const result = parseRuleFlagTokens(BATTLE_EDITION, [token]);
    expect(result).toEqual({
      kind: "error",
      error: { kind: "unknownFlagValue", token },
    });
  });

  it("is case-sensitive: a near-miss casing is rejected, not accepted", () => {
    const token = "diagonal_attackable=all";
    const result = parseRuleFlagTokens(BATTLE_EDITION, [token]);
    expect(result).toEqual({
      kind: "error",
      error: { kind: "unknownFlagId", token },
    });
  });

  it("rejects the same flag id given twice, naming the second (offending) token", () => {
    const secondToken = "DIAGONAL_ATTACKABLE=movable_only";
    const result = parseRuleFlagTokens(BATTLE_EDITION, [
      "DIAGONAL_ATTACKABLE=all",
      secondToken,
    ]);
    expect(result).toEqual({
      kind: "error",
      error: { kind: "repeatedFlagId", token: secondToken },
    });
  });
});

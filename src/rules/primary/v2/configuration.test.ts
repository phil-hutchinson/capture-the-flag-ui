import { describe, expect, it } from "vitest";
import {
  configureRules,
  deviatingFlags,
  isStandardConfiguration,
  STANDARD_BATTLE_CONFIGURATION,
  STANDARD_SKIRMISH_CONFIGURATION,
} from "./configuration.ts";
import {
  BATTLE_EDITION,
  editionById,
  SKIRMISH_EDITION,
  SUPERSEDED_SKIRMISH_EDITION,
} from "./edition.ts";
import { RULE_FLAG_CATALOG, RULE_FLAG_IDS } from "./ruleFlags.ts";

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

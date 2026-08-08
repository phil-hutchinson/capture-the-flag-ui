import { describe, expect, it } from "vitest";
import {
  configureRules,
  STANDARD_BATTLE_CONFIGURATION,
  STANDARD_SKIRMISH_CONFIGURATION,
} from "../rules/primary/v2/configuration.ts";
import {
  BATTLE_EDITION,
  SUPERSEDED_SKIRMISH_EDITION,
} from "../rules/primary/v2/edition.ts";
import { buildGameConfiguration } from "../rules/primary/v2/games.ts";
import {
  boardSizeDescription,
  defaultGameId,
  gameName,
  gameNameForConfiguration,
} from "./gameNames.ts";

describe("gameName", () => {
  it("names battle as Battle", () => {
    expect(gameName("battle")).toBe("Battle");
  });

  it("names skirmish as Skirmish", () => {
    expect(gameName("skirmish")).toBe("Skirmish");
  });

  it("names clash as Clash", () => {
    expect(gameName("clash")).toBe("Clash");
  });
});

describe("gameNameForConfiguration", () => {
  it("names the standard Battle configuration Battle", () => {
    expect(gameNameForConfiguration(STANDARD_BATTLE_CONFIGURATION)).toBe(
      "Battle",
    );
  });

  it("names the standard Skirmish configuration Skirmish", () => {
    expect(gameNameForConfiguration(STANDARD_SKIRMISH_CONFIGURATION)).toBe(
      "Skirmish",
    );
  });

  it("names the superseded 2-0:SKIRMISH configuration Skirmish too, so a historical record still names its game correctly", () => {
    expect(
      gameNameForConfiguration(configureRules(SUPERSEDED_SKIRMISH_EDITION)),
    ).toBe("Skirmish");
  });

  it("names a Clash configuration Clash", () => {
    expect(gameNameForConfiguration(buildGameConfiguration("clash"))).toBe(
      "Clash",
    );
  });

  it("returns null for a configuration matching no catalogued game", () => {
    const oddCombination = configureRules(BATTLE_EDITION, {
      BOARD_LAYOUT: "asymmetric_100",
    });
    expect(gameNameForConfiguration(oddCombination)).toBeNull();
  });
});

describe("boardSizeDescription", () => {
  it("describes Battle's 12x12 board", () => {
    expect(boardSizeDescription(STANDARD_BATTLE_CONFIGURATION)).toBe(
      "a 12x12 board",
    );
  });

  it("describes Skirmish's 8x8 board with an 'an' article", () => {
    expect(boardSizeDescription(STANDARD_SKIRMISH_CONFIGURATION)).toBe(
      "an 8x8 board",
    );
  });

  it("describes Clash's 10x10 board", () => {
    expect(boardSizeDescription(buildGameConfiguration("clash"))).toBe(
      "a 10x10 board",
    );
  });
});

describe("defaultGameId (which game GameChoice pre-selects)", () => {
  it("is skirmish on the first game of a session, when nothing has been played yet", () => {
    expect(defaultGameId(null)).toBe("skirmish");
  });

  it("is battle after a Battle game was just played", () => {
    expect(defaultGameId(STANDARD_BATTLE_CONFIGURATION)).toBe("battle");
  });

  it("is skirmish after a Skirmish game was just played", () => {
    expect(defaultGameId(STANDARD_SKIRMISH_CONFIGURATION)).toBe("skirmish");
  });

  it("is skirmish after a superseded-Skirmish game was just played, for completeness of the mapping", () => {
    expect(defaultGameId(configureRules(SUPERSEDED_SKIRMISH_EDITION))).toBe(
      "skirmish",
    );
  });

  it("is clash after a Clash game was just played", () => {
    expect(defaultGameId(buildGameConfiguration("clash"))).toBe("clash");
  });
});

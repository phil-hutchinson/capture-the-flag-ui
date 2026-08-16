import { describe, expect, it } from "vitest";
import type { GameSelection } from "../games/gameCatalog.ts";
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
  reviewedGameLine,
} from "./gameNames.ts";

/** A minimal `GameSelection` for `defaultGameId`'s tests - the rule choices are irrelevant to which game it returns. */
function selectionOf(gameId: GameSelection["gameId"]): GameSelection {
  return {
    gameId,
    ruleChoices: {
      DIAGONAL_ATTACKABLE: "movable_only",
      DIAGONAL_ATTACK_PATH: "always",
    },
  };
}

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
    expect(defaultGameId(selectionOf("battle"))).toBe("battle");
  });

  it("is skirmish after a Skirmish game was just played", () => {
    expect(defaultGameId(selectionOf("skirmish"))).toBe("skirmish");
  });

  it("is clash after a Clash game was just played", () => {
    expect(defaultGameId(selectionOf("clash"))).toBe("clash");
  });

  it("is demotion after a Demotion game was just played, holding across a major boundary (story 00000036, Step 12)", () => {
    expect(defaultGameId(selectionOf("demotion"))).toBe("demotion");
  });
});

describe("reviewedGameLine (the review screen's game-identification line)", () => {
  it("names Battle for a fully-understood Battle configuration", () => {
    expect(reviewedGameLine(STANDARD_BATTLE_CONFIGURATION, [])).toBe(
      "This is a Battle game, on a 12x12 board.",
    );
  });

  it("names Skirmish for a fully-understood Skirmish configuration", () => {
    expect(reviewedGameLine(STANDARD_SKIRMISH_CONFIGURATION, [])).toBe(
      "This is a Skirmish game, on an 8x8 board.",
    );
  });

  it("names Clash for a fully-understood Clash configuration", () => {
    expect(reviewedGameLine(buildGameConfiguration("clash"), [])).toBe(
      "This is a Clash game, on a 10x10 board.",
    );
  });

  it("names Skirmish for a superseded-Skirmish record, so a historical record still names its game correctly", () => {
    expect(
      reviewedGameLine(configureRules(SUPERSEDED_SKIRMISH_EDITION), []),
    ).toBe("This is a Skirmish game, on an 8x8 board.");
  });

  it("is omitted (null) when the record carried an unresolved Ruleset token, even though the configuration still matches a catalogued game", () => {
    expect(
      reviewedGameLine(buildGameConfiguration("clash"), [
        "DIAGONAL_ATTACKABLE=something_unheard_of",
      ]),
    ).toBeNull();
  });

  it("is omitted (null) when the configuration matches no catalogued game", () => {
    const oddCombination = configureRules(BATTLE_EDITION, {
      BOARD_LAYOUT: "asymmetric_100",
    });
    expect(reviewedGameLine(oddCombination, [])).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { armySize } from "./armyComposition.ts";
import {
  configureRules,
  deviatingFlags,
  renderRulesetTag,
} from "./configuration.ts";
import {
  BATTLE_EDITION,
  combinationFits,
  SUPERSEDED_SKIRMISH_EDITION,
} from "./edition.ts";
import {
  buildGameConfiguration,
  GAME_IDS,
  GAMES,
  identifyGame,
  playableGames,
  type GameId,
} from "./games.ts";

describe("GAMES catalog", () => {
  it("covers exactly the three games", () => {
    expect(GAME_IDS).toEqual(["battle", "skirmish", "clash"]);
    expect(Object.keys(GAMES).sort()).toEqual(
      ["battle", "clash", "skirmish"].sort(),
    );
  });

  it.each([
    ["battle", "2-0:BATTLE", 12, 12, 25],
    ["skirmish", "2-1:SKIRMISH", 8, 8, 16],
    ["clash", "2-0:BATTLE", 10, 10, 20],
  ] as const)(
    "%s's standard configuration resolves the expected board, army and edition id",
    (gameId, editionId, columnCount, rowCount, expectedArmySize) => {
      const configuration = buildGameConfiguration(gameId as GameId);

      expect(configuration.edition.id).toBe(editionId);
      expect(configuration.boardLayout.columnCount).toBe(columnCount);
      expect(configuration.boardLayout.rowCount).toBe(rowCount);
      expect(armySize(configuration.army)).toBe(expectedArmySize);
    },
  );

  it("Battle's and Skirmish's standard configurations render bare edition tags", () => {
    expect(renderRulesetTag(buildGameConfiguration("battle"))).toBe(
      "2-0:BATTLE",
    );
    expect(renderRulesetTag(buildGameConfiguration("skirmish"))).toBe(
      "2-1:SKIRMISH",
    );
  });

  it("Clash's standard configuration renders the expected three-token tag", () => {
    expect(renderRulesetTag(buildGameConfiguration("clash"))).toBe(
      "2-0:BATTLE ARMY_COMPOSITION=standard_clash BOARD_LAYOUT=asymmetric_100",
    );
  });

  it("layers a rule-choice override on top of a game's own game-defining values", () => {
    const configuration = buildGameConfiguration("clash", {
      DIAGONAL_ATTACKABLE: "all",
    });

    expect(configuration.flags.ARMY_COMPOSITION).toBe("standard_clash");
    expect(configuration.flags.BOARD_LAYOUT).toBe("asymmetric_100");
    expect(configuration.flags.DIAGONAL_ATTACKABLE).toBe("all");
    expect(deviatingFlags(configuration)).toEqual([
      "ARMY_COMPOSITION",
      "BOARD_LAYOUT",
      "DIAGONAL_ATTACKABLE",
    ]);
  });
});

describe("playableGames", () => {
  it("holds exactly the three catalogued games", () => {
    expect([...playableGames()].sort()).toEqual(
      ["battle", "clash", "skirmish"].sort(),
    );
  });

  // story.md's "the fit test is the floor, not the rule": a pairing can pass
  // `combinationFits` without ever being offered, because the catalog above
  // simply never declares it as a game.
  it("standard_battle on asymmetric_100 fits (25 <= 30) but is not one of the three offered games", () => {
    expect(combinationFits("asymmetric_100", "standard_battle")).toBe(true);
    for (const gameId of playableGames()) {
      const configuration = buildGameConfiguration(gameId);
      const isThatPairing =
        configuration.flags.BOARD_LAYOUT === "asymmetric_100" &&
        configuration.flags.ARMY_COMPOSITION === "standard_battle";
      expect(isThatPairing).toBe(false);
    }
  });
});

describe("identifyGame", () => {
  it.each(["battle", "skirmish", "clash"] as const)(
    "identifies %s's own standard configuration",
    (gameId) => {
      expect(identifyGame(buildGameConfiguration(gameId))).toBe(gameId);
    },
  );

  it("identifies a configuration built on the superseded 2-0:SKIRMISH edition as skirmish", () => {
    const configuration = configureRules(SUPERSEDED_SKIRMISH_EDITION);
    expect(identifyGame(configuration)).toBe("skirmish");
  });

  it("is unaffected by a deviating diagonal flag", () => {
    const configuration = buildGameConfiguration("clash", {
      DIAGONAL_ATTACK_PATH: "open_path",
    });
    expect(identifyGame(configuration)).toBe("clash");
  });

  it("returns null for a hand-built configuration pairing standard_battle with asymmetric_100", () => {
    const configuration = configureRules(BATTLE_EDITION, {
      BOARD_LAYOUT: "asymmetric_100",
    });
    expect(identifyGame(configuration)).toBeNull();
  });
});

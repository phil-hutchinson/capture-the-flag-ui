// Game choice for the hot-seat game (story 00000023, Step 7), extended by
// story 00000027's Step 8 to also offer the two diagonal-attack rule
// choices, and by story 00000030's Step 9 to a third game, Clash.
//
// The first thing a player does when starting a hot-seat game: pick which
// game to play, named exactly as the rules do - "Battle", "Skirmish" or
// "Clash" - in plain language, with no "edition"/"flag"/"ply" jargon, and (per
// story.md's Policy) no "experimental"/"proposed"/"pre-release" framing of any
// kind - everything on this screen is pre-release, and all of it gets equal
// billing. Mirrors `EngineSideChoice.tsx`'s established shape (an in-progress
// choice held locally, reported to the caller only once confirmed): the game
// buttons behave like `EngineSideChoice`'s difficulty picker (`aria-pressed`
// toggles which is currently chosen) plus one explicit "Play" action that
// starts placement for whichever is currently selected - unlike
// `EngineSideChoice`'s side buttons (which both choose and start in one
// click), a single "Play" button here reads naturally once a game is already
// highlighted as selected - its name shown as pressed directly above - and
// keeps the description of the currently-selected game in one settled place
// rather than repeating it on several directly-actionable buttons. (Story
// 00000034 shortened the button's own label from "Play <Game>" to plain
// "Play", for the same reason - the selected game is already shown above
// it.)
//
// Which game starts pre-selected (owner feedback at the Step 7 manual gate,
// 2026-08-01): Skirmish on the first game of a session (`lastPlayed` is
// `null`), per story.md's "recommended first game" - but after a finished
// game and "New game" (which returns to this picker), the last game actually
// played, so a player who just finished a Clash game sees Clash pre-selected
// again rather than being reset to Skirmish every time. See `gameNames.ts`'s
// `defaultGameId`.
//
// The games themselves come from `games.ts`'s catalog (story 00000030's
// Decision 6), not from the edition registry: two of the three games
// (Battle and Clash) share an edition id, so "the playable editions" is no
// longer a meaningful question to ask here - `playableGames()` is.
//
// Story 00000036's implementation plan, Step 12: the button list, each
// game's description and their display order now come from
// `../games/gameCatalog.ts`'s `GAME_CATALOG`/`offeredGames()` - the
// app-level identity that spans both ruleset majors - rather than this
// module's own private `GAME_DETAIL`/`gameOrderRank` records keyed by major
// 2's `GameId`. `offeredGames()` still excludes Demotion at this step (Step
// 14 adds it), so the three buttons, their copy and their order are
// unchanged; `choice` is now an `AppGameId`, and "Play" still builds a
// major-2 `RuleConfiguration` exactly as before, narrowing the chosen
// entry's `source` to major 2 first (every entry `offeredGames()` returns
// today is major 2, so that narrowing never actually fails).
//
// Story 00000027's implementation plan, Decision 8: the two diagonal-attack
// rule choices sit in one new section between the selected game's
// description and the "Play" button, offered identically for every
// game and unaffected by which one is currently selected. Each choice is
// rendered from `ruleChoices.ts`'s `RULE_CHOICES` as the same `aria-pressed`
// two-button group the game buttons above use, with the selected option's
// one-sentence description shown beneath it - no form controls, no
// "experimental"/"variant" framing, no per-game variation. `onChoose` now
// reports the chosen game's app-level `GameSelection` alongside the full
// `RuleConfiguration` it built (story 00000036's implementation plan, Step
// 12 - see above); `lastPlayed` widens the same way, so this screen
// pre-selects the game *and* both flag values just played (Decision 9),
// falling back to the standard value of each flag (via each choice's own
// "standard" option, from `RULE_CHOICE_COPY`) when there is none.
//
// `HotSeatGame.tsx` renders this in place of its own placement UI until a
// game is chosen; nothing is lost by choosing (or re-choosing, after "New
// game") since this is always the very first screen of a fresh hot-seat game.

import { useState } from "react";
import {
  GAME_CATALOG,
  offeredGames,
  ruleChoicesFromConfiguration,
  type AppGameId,
  type GameSelection,
} from "../games/gameCatalog.ts";
import type { RuleConfiguration } from "../rules/primary/v2/configuration.ts";
import {
  buildGameConfiguration,
  type RuleChoiceOverrides,
} from "../rules/primary/v2/games.ts";
import {
  RULE_CHOICE_FLAG_IDS,
  type RuleChoiceFlagId,
} from "../rules/primary/v2/ruleFlags.ts";
import { defaultGameId, gameName } from "./gameNames.ts";
import {
  RULE_CHOICES,
  RULE_CHOICES_HEADING,
  type RuleChoiceDescriptor,
} from "./ruleChoices.ts";
import "./GameChoice.css";

export interface GameChoiceProps {
  /**
   * Starts play for the chosen game: its app-level `GameSelection` (Step
   * 12), and the major-2 `RuleConfiguration` built for it.
   */
  readonly onChoose: (
    selection: GameSelection,
    configuration: RuleConfiguration,
  ) => void;
  /**
   * The selection most recently played this session, if any - pre-selects
   * that game and both diagonal-attack rule choices from it. `null` on the
   * first game of a session, when Skirmish and the standard value of each
   * choice stay pre-selected (story.md).
   */
  readonly lastPlayed: GameSelection | null;
}

/**
 * Which value is currently selected for `choice`: the player's own choice
 * from `flagOverrides` if they have touched this flag's buttons this
 * session, otherwise the option `ruleChoices.ts` marks as standard - which is
 * exactly what an absent override resolves to (`configureRules`), so this
 * mirrors the rules engine's own resolution without needing to import it.
 *
 * Peer review #6 (owner decision: document only, no behaviour change). This
 * fallback is the catalog default (`ruleChoices.ts`'s `isStandard`), not
 * `configuration.ts`'s own `resolvedEditionValue` (the edition's stated
 * value, falling back to the catalog default only when the edition doesn't
 * state one). The two are indistinguishable today because no registered
 * edition states a value for either *rule-choice* flag - `resolvedEditionValue`'s
 * doc comment names that as the documented extension point for the day one
 * does, at which point this fallback would diverge from what the engine
 * actually resolves for the *selected* game (this function has no game in
 * scope at all, only the flag choice). Fixing this would mean threading the
 * selected `GameId` in and calling `resolvedEditionValue`-equivalent logic
 * here instead of reading `isStandard` off the catalog; out of scope for
 * this pass.
 */
function selectedRuleValue(
  choice: RuleChoiceDescriptor,
  flagOverrides: Partial<Record<RuleChoiceFlagId, string>>,
): string {
  const standardOption = choice.options.find((option) => option.isStandard);
  // Every `RuleChoiceDescriptor` has exactly one standard option
  // (`ruleChoices.ts`'s `buildRuleChoice` marks it from the flag catalog's
  // own default), so `?? choice.options[0].value` never actually applies -
  // kept only so TypeScript sees a `string`, not `string | undefined`.
  return (
    flagOverrides[choice.flagId] ??
    standardOption?.value ??
    choice.options[0].value
  );
}

/**
 * "Skirmish" / "Clash" / "Battle" plus both diagonal-attack rule choices -
 * the new-game screen, pre-selecting the game and both flag values just
 * played (`lastPlayed`), or Skirmish and the standard value of each flag on
 * the first game of a session.
 */
export function GameChoice({ onChoose, lastPlayed }: GameChoiceProps) {
  const [choice, setChoice] = useState<AppGameId>(() =>
    defaultGameId(lastPlayed),
  );
  // Story 00000027, Step 8: only the flags the player has actually chosen a
  // value for this session are recorded here - initialized from
  // `lastPlayed`'s own resolved flags when there is one, so a returning
  // player sees their own last choice on every button, and left empty
  // otherwise, so `buildGameConfiguration` (below, and in `selectedRuleValue`
  // above via each choice's "standard" option) supplies the standard value of
  // whichever flag is never touched. A `Partial<Record<...>>` of plain
  // strings, rather than the rules engine's own `RuleChoiceOverrides`,
  // because a button's `value` is read generically off `RuleChoiceDescriptor`
  // here and cannot carry each flag's own literal-value type - the one cast
  // this component needs, at the "Play" button below, mirrors
  // `ruleChoices.ts`'s own `buildRuleChoice`/`nonStandardRuleSentences` casts
  // for the same reason.
  //
  // Story 00000030's Step 9: seeded from only the *rule-choice* flags
  // (`RULE_CHOICE_FLAG_IDS` - today, the two diagonal flags), not every flag
  // in `lastPlayed`. This narrows peer review #6's documented coupling
  // (below) to the two rule-choice flags only, and it fixes a real bug the
  // old "seed from every flag" behaviour would otherwise have on this
  // screen now that `BOARD_LAYOUT`/`ARMY_COMPOSITION` are flags too
  // (Decision 5): seeding those two as well would carry the *previously
  // played* game's board and army forward as explicit overrides, so playing
  // Clash, returning here, and then picking Battle would silently build a
  // Battle-edition game still playing Clash's board and army. Game-defining
  // flags are chosen by choosing a game (`choice`, above) and come from
  // `games.ts`'s own catalog entry, never from this state. Story 00000036's
  // Step 12: seeded from `lastPlayed.ruleChoices` (a `GameSelection`) rather
  // than a `RuleConfiguration`'s own `flags` - the same two values, just
  // carried in the app-level session memory now, including when the last
  // game played was Demotion (whose own rules ignore them, but whose
  // `GameSelection` still carries whatever the picker showed at the time -
  // `gameCatalog.ts`'s own header comment).
  //
  // Peer review #6 (owner decision: document only, no behaviour change).
  // Seeding from *every rule-choice flag* in `lastPlayed` converts a
  // value that was merely *resolved* for the previously-played edition into
  // an explicit *override* for whatever edition is chosen next. That's the
  // same coupling `selectedRuleValue` above has: harmless today (no
  // registered edition states a value for either diagonal flag, so
  // "resolved" and "catalog default" always agree), but on the day one does,
  // switching games on this screen would silently carry the previous
  // edition's resolved value across as an override, rather than picking up
  // the newly-selected edition's own stated value. See `configuration.ts`'s
  // `resolvedEditionValue` for the extension point this would need to read
  // instead. Fixing this would mean seeding only the flags that actually
  // deviated (`deviatingFlags(lastPlayed)`) rather than every rule-choice
  // flag; out of scope for this pass.
  const [flagOverrides, setFlagOverrides] = useState<
    Partial<Record<RuleChoiceFlagId, string>>
  >(() => {
    if (lastPlayed === null) {
      return {};
    }
    const seeded: Partial<Record<RuleChoiceFlagId, string>> = {};
    for (const flagId of RULE_CHOICE_FLAG_IDS) {
      seeded[flagId] = lastPlayed.ruleChoices[flagId];
    }
    return seeded;
  });
  const games = offeredGames();

  function handleChooseFlag(flagId: RuleChoiceFlagId, value: string) {
    setFlagOverrides((current) => ({ ...current, [flagId]: value }));
  }

  function handlePlay() {
    const entry = GAME_CATALOG[choice];
    if (entry.source.major !== 2) {
      // Unreachable this step: `AppGameId` includes Demotion from the start
      // (Decision 3), but `offeredGames()` excludes it until Step 14, so
      // `choice` can never actually be Demotion here yet. Kept only so
      // TypeScript can narrow `entry.source` to the major-2 variant below.
      return;
    }
    const configuration = buildGameConfiguration(
      entry.source.gameId,
      flagOverrides as RuleChoiceOverrides,
    );
    onChoose(
      {
        gameId: choice,
        ruleChoices: ruleChoicesFromConfiguration(configuration),
      },
      configuration,
    );
  }

  return (
    <div className="game-choice">
      <h2 className="game-choice__title">Choose a game</h2>
      <div
        className="game-choice__options"
        role="group"
        aria-label="Which game"
      >
        {games.map((id) => (
          <button
            key={id}
            type="button"
            className="game-choice__option"
            data-game={id}
            aria-pressed={choice === id}
            onClick={() => setChoice(id)}
          >
            {gameName(id)}
          </button>
        ))}
      </div>
      <p className="game-choice__detail">{GAME_CATALOG[choice].description}</p>
      <div className="game-choice__rules">
        <h3 className="game-choice__rules-heading">{RULE_CHOICES_HEADING}</h3>
        {RULE_CHOICES.map((ruleChoice) => {
          const selectedValue = selectedRuleValue(ruleChoice, flagOverrides);
          const selectedOption = ruleChoice.options.find(
            (option) => option.value === selectedValue,
          );
          const headingId = `game-choice__rule-heading--${ruleChoice.flagId}`;
          return (
            <div key={ruleChoice.flagId} className="game-choice__rule">
              <h4 id={headingId} className="game-choice__rule-heading">
                {ruleChoice.heading}
              </h4>
              <div
                className="game-choice__options"
                role="group"
                aria-labelledby={headingId}
              >
                {ruleChoice.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="game-choice__option"
                    aria-pressed={selectedValue === option.value}
                    onClick={() =>
                      handleChooseFlag(ruleChoice.flagId, option.value)
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {selectedOption ? (
                <p className="game-choice__detail">
                  {selectedOption.description}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <button type="button" className="game-choice__start" onClick={handlePlay}>
        Play
      </button>
    </div>
  );
}

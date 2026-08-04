// Battle/Skirmish choice for the hot-seat game (story 00000023, Step 7),
// extended by story 00000027's Step 8 to also offer the two diagonal-attack
// rule choices.
//
// The first thing a player does when starting a hot-seat game: pick which of
// the two games to play, named exactly as the rules do - "Battle" or
// "Skirmish" - in plain language, with no "edition"/"flag"/"ply" jargon.
// Mirrors `EngineSideChoice.tsx`'s established shape (an in-progress choice
// held locally, reported to the caller only once confirmed): the two game
// buttons behave like `EngineSideChoice`'s difficulty picker (`aria-pressed`
// toggles which is currently chosen) plus one explicit "Play" action that
// starts placement for whichever is currently selected - unlike
// `EngineSideChoice`'s side buttons (which both choose and start in one
// click), a single "Play <Game>" button here reads naturally once a game is
// already highlighted as selected, and keeps the description of the
// currently-selected game in one settled place rather than repeating it on
// two directly-actionable buttons.
//
// Which game starts pre-selected (owner feedback at the Step 7 manual gate,
// 2026-08-01): Skirmish on the first game of a session (`lastPlayed` is
// `null`), per story.md's "recommended first game" - but after a finished
// game and "New game" (which returns to this picker), the last game actually
// played, so a player who just finished a Battle sees Battle pre-selected
// again rather than being reset to Skirmish every time. See `gameNames.ts`'s
// `defaultGameId`.
//
// Story 00000027's implementation plan, Decision 8: the two diagonal-attack
// rule choices sit in one new section between the selected game's
// description and the "Play <Game>" button, offered identically for both
// games and unaffected by which one is currently selected. Each choice is
// rendered from `ruleChoices.ts`'s `RULE_CHOICES` as the same `aria-pressed`
// two-button group the game buttons above use, with the selected option's
// one-sentence description shown beneath it - no form controls, no
// "experimental"/"variant" framing, no per-game variation. `onChoose` now
// reports a full `RuleConfiguration` (the chosen edition plus both chosen
// flag values) rather than a bare `Edition`; `lastPlayed` widens the same
// way, so this screen pre-selects the game *and* both flag values just
// played (Decision 9), falling back to the standard value of each flag (via
// each choice's own "standard" option, from `RULE_CHOICE_COPY`) when there is
// none.
//
// `HotSeatGame.tsx` renders this in place of its own placement UI until a
// game is chosen; nothing is lost by choosing (or re-choosing, after "New
// game") since this is always the very first screen of a fresh hot-seat game.

import { useState } from "react";
import {
  configureRules,
  type RuleConfiguration,
  type RuleFlagOverrides,
} from "../rules/primary/v2/configuration.ts";
import {
  editionById,
  playableEditions,
  type EditionId,
} from "../rules/primary/v2/edition.ts";
import type { RuleFlagId } from "../rules/primary/v2/ruleFlags.ts";
import { defaultGameId, gameName } from "./gameNames.ts";
import {
  RULE_CHOICES,
  RULE_CHOICES_HEADING,
  type RuleChoiceDescriptor,
} from "./ruleChoices.ts";
import "./GameChoice.css";

export interface GameChoiceProps {
  /** Starts placement for the chosen configuration. */
  readonly onChoose: (configuration: RuleConfiguration) => void;
  /**
   * The configuration most recently played this session, if any - pre-selects
   * that game and both diagonal-attack rule choices from it. `null` on the
   * first game of a session, when Skirmish and the standard value of each
   * choice stay pre-selected (story.md).
   */
  readonly lastPlayed: RuleConfiguration | null;
}

/**
 * One selectable game's plain-language description, keyed by its edition id.
 * Covers all three registered ids (rather than only the two currently
 * playable) so the record stays type-complete as a fourth edition would fail
 * to compile here; only the ids `playableEditions()` returns are ever
 * actually rendered, so the superseded `2-0:SKIRMISH` entry below is never
 * shown to a player. Story 00000025, Step 7: `2-1:SKIRMISH`'s description
 * gains a clause about the tower/lane restriction, so a player meets the
 * rule before it ever refuses them at placement; `2-0:SKIRMISH`'s text is
 * deliberately left without that clause (it never had the rule) even though
 * it is unreachable in the picker.
 */
const GAME_DETAIL: Readonly<Record<EditionId, string>> = {
  "2-1:SKIRMISH":
    "A smaller game, recommended if this is your first time playing: an 8x8 board with a 16-piece army, and the armies start closer together. A Tower can't be placed directly in front of a lane, one of the open columns running through the middle of the board.",
  "2-0:SKIRMISH":
    "A smaller game, recommended if this is your first time playing: an 8x8 board with a 16-piece army, and the armies start closer together.",
  "2-0:BATTLE": "The full game: a 12x12 board with a 25-piece army.",
};

/**
 * Skirmish listed first (and selected below by default) per story.md: "the
 * recommended game for a new player" - the gentler introduction with a
 * smaller board and a smaller army. The list itself always comes from
 * `playableEditions()`, never a hardcoded id list, so the superseded
 * `2-0:SKIRMISH` can never be offered here; this only decides *display
 * order* among whatever `playableEditions()` returns.
 */
function gameOrderRank(id: EditionId): number {
  switch (id) {
    case "2-1:SKIRMISH":
      return 0;
    case "2-0:BATTLE":
      return 1;
    case "2-0:SKIRMISH":
      return 2;
  }
}

/**
 * Which value is currently selected for `choice`: the player's own choice
 * from `flagOverrides` if they have touched this flag's buttons this
 * session, otherwise the option `ruleChoices.ts` marks as standard - which is
 * exactly what an absent override resolves to (`configureRules`), so this
 * mirrors the rules engine's own resolution without needing to import it.
 */
function selectedRuleValue(
  choice: RuleChoiceDescriptor,
  flagOverrides: Partial<Record<RuleFlagId, string>>,
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
 * "Skirmish" / "Battle" plus both diagonal-attack rule choices - the
 * new-game screen, pre-selecting the game and both flag values just played
 * (`lastPlayed`), or Skirmish and the standard value of each flag on the
 * first game of a session.
 */
export function GameChoice({ onChoose, lastPlayed }: GameChoiceProps) {
  const [choice, setChoice] = useState<EditionId>(() =>
    defaultGameId(lastPlayed?.edition ?? null),
  );
  // Story 00000027, Step 8: only the flags the player has actually chosen a
  // value for this session are recorded here - initialized from
  // `lastPlayed`'s own resolved flags when there is one, so a returning
  // player sees their own last choice on every button, and left empty
  // otherwise, so `configureRules` (below, and in `selectedRuleValue` above
  // via each choice's "standard" option) supplies the standard value of
  // whichever flag is never touched. A `Partial<Record<...>>` of plain
  // strings, rather than the rules engine's own `RuleFlagOverrides`, because
  // a button's `value` is read generically off `RuleChoiceDescriptor` here
  // and cannot carry each flag's own literal-value type - the one cast this
  // component needs, at the "Play <Game>" button below, mirrors
  // `ruleChoices.ts`'s own `buildRuleChoice`/`nonStandardRuleSentences` casts
  // for the same reason.
  const [flagOverrides, setFlagOverrides] = useState<
    Partial<Record<RuleFlagId, string>>
  >(() => (lastPlayed ? { ...lastPlayed.flags } : {}));
  const selectedEdition = editionById(choice);
  const games = [...playableEditions()].sort(
    (a, b) => gameOrderRank(a.id) - gameOrderRank(b.id),
  );

  function handleChooseFlag(flagId: RuleFlagId, value: string) {
    setFlagOverrides((current) => ({ ...current, [flagId]: value }));
  }

  function handlePlay() {
    onChoose(
      configureRules(selectedEdition, flagOverrides as RuleFlagOverrides),
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
        {games.map((edition) => (
          <button
            key={edition.id}
            type="button"
            className="game-choice__option"
            data-game={edition.id}
            aria-pressed={choice === edition.id}
            onClick={() => setChoice(edition.id)}
          >
            {gameName(edition)}
          </button>
        ))}
      </div>
      <p className="game-choice__detail">{GAME_DETAIL[choice]}</p>
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
        Play {gameName(selectedEdition)}
      </button>
    </div>
  );
}

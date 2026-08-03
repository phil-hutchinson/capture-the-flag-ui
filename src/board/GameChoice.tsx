// Battle/Skirmish choice for the hot-seat game (story 00000023, Step 7).
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
// `HotSeatGame.tsx` renders this in place of its own placement UI until a
// game is chosen; nothing is lost by choosing (or re-choosing, after "New
// game") since this is always the very first screen of a fresh hot-seat game.

import { useState } from "react";
import {
  EDITIONS,
  type Edition,
  type EditionId,
} from "../rules/primary/v2/edition.ts";
import { defaultGameId, gameName } from "./gameNames.ts";
import "./GameChoice.css";

export interface GameChoiceProps {
  /** Starts placement for the chosen game. */
  readonly onChoose: (edition: Edition) => void;
  /**
   * The game most recently played this session, if any - pre-selects that
   * game. `null` on the first game of a session, when Skirmish stays
   * pre-selected as the recommended first game (story.md).
   */
  readonly lastPlayed: Edition | null;
}

/** One selectable game's plain-language description, keyed by its edition id. */
const GAME_DETAIL: Readonly<Record<EditionId, string>> = {
  "2-0:SKIRMISH":
    "A smaller game, recommended if this is your first time playing: an 8x8 board with a 16-piece army, and the armies start closer together.",
  "2-0:BATTLE": "The full game: a 12x12 board with a 25-piece army.",
};

// Skirmish listed first (and selected below by default) per story.md: "the
// recommended game for a new player" - the gentler introduction with a
// smaller board and a smaller army.
const GAME_ORDER: readonly EditionId[] = ["2-0:SKIRMISH", "2-0:BATTLE"];

/**
 * "Skirmish" / "Battle" - the two games' choice screen, pre-selecting the
 * game just played (`lastPlayed`), or Skirmish on the first game of a
 * session.
 */
export function GameChoice({ onChoose, lastPlayed }: GameChoiceProps) {
  const [choice, setChoice] = useState<EditionId>(() =>
    defaultGameId(lastPlayed),
  );
  const selectedEdition = EDITIONS[choice];

  return (
    <div className="game-choice">
      <h2 className="game-choice__title">Choose a game</h2>
      <div
        className="game-choice__options"
        role="group"
        aria-label="Which game"
      >
        {GAME_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className="game-choice__option"
            data-game={id}
            aria-pressed={choice === id}
            onClick={() => setChoice(id)}
          >
            {gameName(EDITIONS[id])}
          </button>
        ))}
      </div>
      <p className="game-choice__detail">{GAME_DETAIL[choice]}</p>
      <button
        type="button"
        className="game-choice__start"
        onClick={() => onChoose(selectedEdition)}
      >
        Play {gameName(selectedEdition)}
      </button>
    </div>
  );
}

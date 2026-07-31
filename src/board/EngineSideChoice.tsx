// Side choice for the against-the-computer mode (story 00000019, Step 5;
// difficulty choice added story 00000021, Step 4).
//
// The first thing a player does after choosing "Play against the computer"
// from the start screen: pick a difficulty, then which color they will play.
// Red moves first (rules.md), so playing blue means the computer makes the
// opening move. This component owns only the in-progress difficulty
// selection (so Medium is preselected without `EngineGame.tsx` having to);
// `EngineGame.tsx` renders it while `humanSide` is still unset and swaps it
// out for the placement UI the instant a side is chosen, at which point the
// side *and* the currently-selected difficulty are both reported through
// `onChoose`. The shared "Back to start" button and heading `EngineGame.tsx`
// renders around every phase already cover "a way back to the start screen"
// from here - nothing is in progress yet, so that back button never needs to
// confirm at this phase.
//
// The difficulty only sets the computer's search iteration budget (story
// 00000021); nothing about the side choice's own behavior changes.

import { useState } from "react";
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_MODES,
  type Difficulty,
} from "../engine/difficulty.ts";
import type { Side } from "../rules/primary/v1/board.ts";
import "./EngineSideChoice.css";

export interface EngineSideChoiceProps {
  /** Starts placement for the chosen side, at the currently-selected difficulty. */
  readonly onChoose: (side: Side, difficulty: Difficulty) => void;
}

/**
 * "Easy" / "Medium" / "Hard", then "Play as red" / "Play as blue" - the
 * against-the-computer mode's difficulty and side choice. The iteration
 * numbers behind each difficulty are deliberately not shown (fixed decision
 * 7 - a non-technical player just picks how hard the computer should try).
 */
export function EngineSideChoice({ onChoose }: EngineSideChoiceProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);

  return (
    <div className="engine-side-choice">
      <h2 className="engine-side-choice__title">Choose your side</h2>
      <p className="engine-side-choice__detail">
        Red moves first. Play red to move first yourself, or play blue and let
        the computer open the game.
      </p>
      <div
        className="engine-side-choice__difficulty"
        role="group"
        aria-label="Difficulty"
      >
        {DIFFICULTY_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className="engine-side-choice__difficulty-choice"
            data-difficulty={mode.id}
            aria-pressed={difficulty === mode.id}
            onClick={() => setDifficulty(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <div className="engine-side-choice__choices">
        <button
          type="button"
          className="engine-side-choice__choice"
          data-side="white"
          onClick={() => onChoose("white", difficulty)}
        >
          Play as red
        </button>
        <button
          type="button"
          className="engine-side-choice__choice"
          data-side="black"
          onClick={() => onChoose("black", difficulty)}
        >
          Play as blue
        </button>
      </div>
    </div>
  );
}

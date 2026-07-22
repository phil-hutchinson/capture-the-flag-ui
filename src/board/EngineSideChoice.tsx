// Side choice for the against-the-computer mode (story 00000019, Step 5).
//
// The first thing a player does after choosing "Play against the computer"
// from the start screen: pick which color they will play. Red moves first
// (rules.md), so playing blue means the computer makes the opening move.
// This component owns no state of its own - `EngineGame.tsx` renders it
// while `humanSide` is still unset and swaps it out for the placement UI the
// instant a side is chosen. The shared "Back to start" button and heading
// `EngineGame.tsx` renders around every phase already cover "a way back to
// the start screen" from here - nothing is in progress yet, so that back
// button never needs to confirm at this phase.

import type { Side } from "../rules/primary/v1/board.ts";
import "./EngineSideChoice.css";

export interface EngineSideChoiceProps {
  /** Starts placement for the chosen side. */
  readonly onChoose: (side: Side) => void;
}

/** "Play as red" / "Play as blue" - the against-the-computer mode's side choice. */
export function EngineSideChoice({ onChoose }: EngineSideChoiceProps) {
  return (
    <div className="engine-side-choice">
      <h2 className="engine-side-choice__title">Choose your side</h2>
      <p className="engine-side-choice__detail">
        Red moves first. Play red to move first yourself, or play blue and let
        the computer open the game.
      </p>
      <div className="engine-side-choice__choices">
        <button
          type="button"
          className="engine-side-choice__choice"
          data-side="white"
          onClick={() => onChoose("white")}
        >
          Play as red
        </button>
        <button
          type="button"
          className="engine-side-choice__choice"
          data-side="black"
          onClick={() => onChoose("black")}
        >
          Play as blue
        </button>
      </div>
    </div>
  );
}

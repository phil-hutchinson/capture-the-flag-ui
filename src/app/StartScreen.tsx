// The start screen: the app's entry point (story 00000014, Step 8). Offers
// the things a player can do here - play a hot-seat game, or review one that
// was recorded earlier - each labeled in plain language a player understands
// without explanation. `App.tsx` mounts this whenever `screen.kind ===
// "start"`; "Play a game" and "Review a game" only ask the shell to switch
// screens.
//
// "Play against the computer" is shown but unavailable (story 00000023, Step
// 9): the trained engine has to be respecified for the major-2 rules before
// it can come back, so the choice is visible - a player is not left
// wondering whether the option exists - but cannot be activated, with a
// short note saying so. `App.tsx` no longer routes anywhere from this
// button.
//
// That button is marked `aria-disabled` with a no-op `onClick`, not the
// native `disabled` attribute (story 00000002, Step 8; decision 7): a
// natively `disabled` button is removed from the tab order entirely, so a
// keyboard or screen-reader user would never reach it or its
// `aria-describedby` note explaining why it is unavailable. This treatment
// is deliberately scoped to this story's surface (see `Tray.tsx`'s header
// comment for the full list) - Phase 2 and the review screens keep native
// `disabled`, which is scope, not oversight.
//
// Focus moves to the heading on mount (a `tabIndex={-1}` heading focused via
// `useEffect`, the same pattern `GameResult.tsx` uses for its "New game"
// button) so a keyboard or screen-reader user landing here - whether at
// app start or after returning from a game - is not stranded on `<body>`.
//
// "How to play" (story 00000032) opens the popup below its own button, first
// in the list of choices (Decision 10) - a player meeting the game for the
// first time finds it before "Play a game". It is the one piece of state
// this component carries: whether the popup is open. The popup itself is
// only reachable from here (story.md's Policy), so `App.tsx` needs no new
// screen and no new route for it.

import { useEffect, useRef, useState } from "react";
import { APP_NAME, TAGLINE } from "../appInfo.ts";
import { HOW_TO_PLAY_BUTTON } from "./rules/rulesCopy.ts";
import { RulesDialog } from "./rules/RulesDialog.tsx";
import "../App.css";
import "./StartScreen.css";

export interface StartScreenProps {
  /** Starts a fresh hot-seat game (placement, then play, two players at one device). */
  readonly onPlayAGame: () => void;
  /** Goes to the import screen, to choose a recorded game to watch. */
  readonly onReviewAGame: () => void;
}

export function StartScreen({ onPlayAGame, onReviewAGame }: StartScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="app">
      <h1 className="app__title" tabIndex={-1} ref={headingRef}>
        {APP_NAME}
      </h1>
      <p className="start-screen__tagline">{TAGLINE}</p>
      <div className="start-screen__choices">
        <button
          type="button"
          className="start-screen__choice"
          onClick={() => {
            setRulesOpen(true);
          }}
        >
          <span className="start-screen__choice-title">
            {HOW_TO_PLAY_BUTTON.title}
          </span>
          <span className="start-screen__choice-detail">
            {HOW_TO_PLAY_BUTTON.detail}
          </span>
        </button>
        <button
          type="button"
          className="start-screen__choice"
          onClick={onPlayAGame}
        >
          <span className="start-screen__choice-title">Play a game</span>
          <span className="start-screen__choice-detail">
            Two players, one device
          </span>
        </button>
        <button
          type="button"
          className="start-screen__choice"
          aria-disabled={true}
          aria-describedby="start-screen__computer-note"
          onClick={() => {
            // Unavailable - see the module header comment. Intentionally a
            // no-op rather than the native `disabled` attribute.
          }}
        >
          <span className="start-screen__choice-title">
            Play against the computer
          </span>
          <span className="start-screen__choice-detail">
            Choose a side, place your army, then play
          </span>
          <span
            id="start-screen__computer-note"
            className="start-screen__choice-note"
          >
            Not available right now - the rules changed and the computer player
            needs to catch up.
          </span>
        </button>
        <button
          type="button"
          className="start-screen__choice"
          onClick={onReviewAGame}
        >
          <span className="start-screen__choice-title">Review a game</span>
          <span className="start-screen__choice-detail">
            Watch a recorded game
          </span>
        </button>
      </div>
      <RulesDialog
        open={rulesOpen}
        onClose={() => {
          setRulesOpen(false);
        }}
      />
    </main>
  );
}

// The start screen: the app's entry point (story 00000014, Step 8). Offers
// exactly the two things a player can do here - play a hot-seat game, or
// review one that was recorded earlier - each labeled in plain language a
// player understands without explanation. `App.tsx` mounts this whenever
// `screen.kind === "start"`; the two buttons only ask the shell to switch
// screens, so this component carries no state of its own.
//
// Focus moves to the heading on mount (a `tabIndex={-1}` heading focused via
// `useEffect`, the same pattern `GameResult.tsx` uses for its "New game"
// button) so a keyboard or screen-reader user landing here - whether at
// app start or after returning from a game - is not stranded on `<body>`.

import { useEffect, useRef } from "react";
import { APP_NAME, TAGLINE } from "../appInfo.ts";
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
          onClick={onReviewAGame}
        >
          <span className="start-screen__choice-title">Review a game</span>
          <span className="start-screen__choice-detail">
            Watch a recorded game
          </span>
        </button>
      </div>
    </main>
  );
}

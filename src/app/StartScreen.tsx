// The start screen: the app's entry point (story 00000014, Step 8). Offers
// the things a player can do here - play a hot-seat game, or review one that
// was recorded earlier - each labeled in plain language a player understands
// without explanation. `App.tsx` mounts this whenever `screen.kind ===
// "start"`.
//
// The choices themselves are data, not markup (story 00000034, Step 2): this
// component maps over `visibleStartScreenChoices(START_SCREEN_CHOICES)` from
// `./startScreenChoices.ts`, so as of that story only "How to play" and "Play
// a game" are shown. "Play against the computer" and "Review a game" are
// hidden by `../featureVisibility.ts`'s `SHOW_PLAY_AGAINST_THE_COMPUTER` and
// `SHOW_REVIEW_A_GAME` - their handlers, routes and the import/review screens
// they lead to all stay wired below and in `App.tsx`; they simply become
// unreachable while their choice is filtered out of the catalog. Flipping
// either constant needs no edit here: the id-to-handler mapping below covers
// all four choices regardless of visibility.
//
// "Play against the computer" carries an unavailability note (story
// 00000023, Step 9: the trained engine has to be respecified for the
// major-2 rules before it can come back) and, when visible, is marked
// `aria-disabled` with a no-op `onClick`, not the native `disabled`
// attribute (story 00000002, Step 8; decision 7): a natively `disabled`
// button is removed from the tab order entirely, so a keyboard or
// screen-reader user would never reach it or its `aria-describedby` note
// explaining why it is unavailable. This treatment is preserved so it comes
// back exactly as it was when the choice is shown again.
//
// Focus moves to the heading on mount (a `tabIndex={-1}` heading focused via
// `useEffect`, the same pattern `GameResult.tsx` uses for its "New game"
// button) so a keyboard or screen-reader user landing here - whether at
// app start or after returning from a game - is not stranded on `<body>`.

import { useEffect, useRef } from "react";
import { APP_NAME, TAGLINE } from "../appInfo.ts";
import {
  START_SCREEN_CHOICES,
  visibleStartScreenChoices,
  type StartScreenChoiceId,
} from "./startScreenChoices.ts";
import "../App.css";
import "./StartScreen.css";

export interface StartScreenProps {
  /** Goes to the "How to play" rules page. */
  readonly onHowToPlay: () => void;
  /** Starts a fresh hot-seat game (placement, then play, two players at one device). */
  readonly onPlayAGame: () => void;
  /** Goes to the import screen, to choose a recorded game to watch. */
  readonly onReviewAGame: () => void;
}

export function StartScreen({
  onHowToPlay,
  onPlayAGame,
  onReviewAGame,
}: StartScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Covers all four choice ids regardless of which are currently visible, so
  // re-enabling a hidden choice needs no edit here.
  const handlers: Readonly<Record<StartScreenChoiceId, () => void>> = {
    howToPlay: onHowToPlay,
    playAGame: onPlayAGame,
    playAgainstTheComputer: () => {
      // Unavailable - see the module header comment. Intentionally a
      // no-op rather than the native `disabled` attribute.
    },
    reviewAGame: onReviewAGame,
  };

  return (
    <main className="app">
      <h1 className="app__title" tabIndex={-1} ref={headingRef}>
        {APP_NAME}
      </h1>
      <p className="start-screen__tagline">{TAGLINE}</p>
      <div className="start-screen__choices">
        {visibleStartScreenChoices(START_SCREEN_CHOICES).map((choice) =>
          choice.note === undefined ? (
            <button
              key={choice.id}
              type="button"
              className="start-screen__choice"
              onClick={handlers[choice.id]}
            >
              <span className="start-screen__choice-title">{choice.title}</span>
              <span className="start-screen__choice-detail">
                {choice.detail}
              </span>
            </button>
          ) : (
            <button
              key={choice.id}
              type="button"
              className="start-screen__choice"
              aria-disabled={true}
              aria-describedby="start-screen__computer-note"
              onClick={handlers[choice.id]}
            >
              <span className="start-screen__choice-title">{choice.title}</span>
              <span className="start-screen__choice-detail">
                {choice.detail}
              </span>
              <span
                id="start-screen__computer-note"
                className="start-screen__choice-note"
              >
                {choice.note}
              </span>
            </button>
          ),
        )}
      </div>
    </main>
  );
}

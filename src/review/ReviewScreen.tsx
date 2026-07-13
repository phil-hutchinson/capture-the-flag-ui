// The review screen (story 00000014). Step 9 lands its first cut: the
// recorded game's opening position on the shared inert board
// (`FullBoard.tsx`, story 00000014 Step 7), always drawn from red's
// perspective - per story.md's "board orientation" decision, a review has no
// hand-off and nothing secret, so there is nothing to flip, unlike the
// hot-seat game's "flip board between turns" setting (which stays out of
// review entirely). No review controls yet (Step 11 adds step/jump), no
// move list (Step 12) and no recorded result (Step 13); this step only
// proves a successful import lands somewhere real, with a heading and a way
// back to the start screen.
//
// Leaving a review never asks for confirmation - unlike a hot-seat game in
// progress (Step 15), nothing here is lost by leaving.

import { useEffect, useRef } from "react";
import "../App.css";
import "./ReviewScreen.css";
import { PieceSpriteDefs } from "../art/PieceIcon.tsx";
import { FullBoard } from "../board/FullBoard.tsx";
import type { ReplayedRecord } from "../rules/primary/v1_1/replay.ts";

export interface ReviewScreenProps {
  /** The fully replayed recorded game (`readRecord.ts`'s success result). */
  readonly record: ReplayedRecord;
  /** Returns to the start screen. Never prompts - reviewing loses nothing. */
  readonly onBack: () => void;
}

/** The review screen: the recorded game, replayed on the shared board. */
export function ReviewScreen({ record, onBack }: ReviewScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="app">
      <PieceSpriteDefs />
      <h1 className="app__title" tabIndex={-1} ref={headingRef}>
        Reviewing a game
      </h1>
      <button type="button" className="review-screen__back" onClick={onBack}>
        Back to start
      </button>
      <FullBoard board={record.positions[0]} side="white" />
    </main>
  );
}

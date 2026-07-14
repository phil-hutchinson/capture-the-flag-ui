// The review screen (story 00000014). Step 9 landed its first cut: only the
// recorded game's opening position on the shared inert board, a heading and
// a way back to the start screen. Step 11 adds the reviewer's own state (the
// cursor over the replayed game, `reviewSession.ts`, Step 10): the step/jump
// controls (`ReviewControls.tsx`), a status line naming where the cursor is
// in the game (round and side - the same slot `PlayStatus` occupies in the
// hot-seat layout), and the last-move highlight on the board
// (`FullBoard.tsx`'s `lastMove` prop, Step 7). No move list yet (Step 12) and
// no recorded result yet (Step 13, which will replace/extend the status line
// at the final position) - the board stays inert throughout: no square is
// activatable, nothing is selectable or movable.
//
// Board orientation is always red's perspective - per story.md's "board
// orientation" decision, a review has no hand-off and nothing secret, so
// there is nothing to flip, unlike the hot-seat game's "flip board between
// turns" setting (which stays out of review entirely).
//
// Leaving a review never asks for confirmation - unlike a hot-seat game in
// progress (Step 15), nothing here is lost by leaving.

import { useEffect, useRef, useState } from "react";
import "../App.css";
import "./ReviewScreen.css";
import { PieceSpriteDefs } from "../art/PieceIcon.tsx";
import { FullBoard } from "../board/FullBoard.tsx";
import type { ReplayedRecord } from "../rules/primary/v1_1/replay.ts";
import {
  createReviewSession,
  currentBoard,
  describeCurrentPosition,
  isAtEnd,
  isAtStart,
  jumpToEnd,
  jumpToStart,
  lastMove,
  stepBack,
  stepForward,
  type ReviewSession,
} from "./reviewSession.ts";
import { ReviewControls } from "./ReviewControls.tsx";

export interface ReviewScreenProps {
  /** The fully replayed recorded game (`readRecord.ts`'s success result). */
  readonly record: ReplayedRecord;
  /** Returns to the start screen. Never prompts - reviewing loses nothing. */
  readonly onBack: () => void;
}

/** The review screen: the recorded game, replayed on the shared board. */
export function ReviewScreen({ record, onBack }: ReviewScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [session, setSession] = useState<ReviewSession>(() =>
    createReviewSession(record),
  );

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const move = lastMove(session);

  return (
    <main className="app">
      <PieceSpriteDefs />
      <h1 className="app__title" tabIndex={-1} ref={headingRef}>
        Reviewing a game
      </h1>
      <button type="button" className="review-screen__back" onClick={onBack}>
        Back to start
      </button>
      <div className="review-status">{describeCurrentPosition(session)}</div>
      <div className="app__layout">
        <div className="app__board-column">
          <FullBoard
            board={currentBoard(session)}
            side="white"
            lastMove={
              move === null
                ? undefined
                : { from: move.move.from, to: move.move.to }
            }
          />
          <ReviewControls
            isAtStart={isAtStart(session)}
            isAtEnd={isAtEnd(session)}
            onJumpToStart={() => setSession(jumpToStart(session))}
            onStepBack={() => setSession(stepBack(session))}
            onStepForward={() => setSession(stepForward(session))}
            onJumpToEnd={() => setSession(jumpToEnd(session))}
          />
        </div>
      </div>
    </main>
  );
}

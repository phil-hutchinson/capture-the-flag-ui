// The review screen (story 00000014). Step 9 landed its first cut: only the
// recorded game's opening position on the shared inert board, a heading and
// a way back to the start screen. Step 11 added the reviewer's own state (the
// cursor over the replayed game, `reviewSession.ts`, Step 10): the step/jump
// controls (`ReviewControls.tsx`), a status line naming where the cursor is
// in the game (round and side - the same slot `PlayStatus` occupies in the
// hot-seat layout), and the last-move highlight on the board
// (`FullBoard.tsx`'s `lastMove` prop, Step 7). Step 12 adds the move list
// (`MoveList.tsx`) in the right-hand column, the same slot `Tray` occupies in
// the hot-seat layout: the game's rounds as recorded, each move a button that
// jumps the cursor straight to the position after it. Step 13 extends the
// status line at the final position with the recorded result - what the
// file's `Result`/`ResultReason` tags claim (`reviewText.ts`'s
// `describeRecordedResult`), quoted back and framed as the record's claim,
// never computed. It disappears the moment the cursor steps back off the end
// (`isAtEnd`), and stays absent throughout if the record carries no result
// tags at all. The board stays inert throughout: no square is activatable,
// nothing is selectable or movable.
//
// Board orientation is always red's perspective - per story.md's "board
// orientation" decision, a review has no hand-off and nothing secret, so
// there is nothing to flip, unlike the hot-seat game's "flip board between
// turns" setting (which stays out of review entirely).
//
// Leaving a review never asks for confirmation - unlike a hot-seat game in
// progress (Step 15), nothing here is lost by leaving.
//
// Story 00000014, Step 14: every step or jump pushes a fresh sentence into
// the board's one polite live region (`FullBoard`'s `announcement` prop,
// `AccessibleGrid.tsx`'s live region underneath it) via
// `reviewSession.ts`'s `describeStepAnnouncement` - the move that was made,
// where the cursor now is, and, at the final position, the recorded result.
// It is set (not merely read) inside `moveTo` below, alongside `setSession`,
// so a screen-reader user hears the same thing a sighted player reads in the
// status line above the board - nothing here announces anything from a
// second live region.

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
  describeStepAnnouncement,
  isAtEnd,
  isAtStart,
  jumpToEnd,
  jumpToMove,
  jumpToStart,
  lastMove,
  recordedResultAt,
  stepBack,
  stepForward,
  type ReviewSession,
} from "./reviewSession.ts";
import { ReviewControls } from "./ReviewControls.tsx";
import { MoveList } from "./MoveList.tsx";

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
  // Empty until the first step or jump, matching `HotSeatGame.tsx`'s
  // `playAnnouncement` pattern - nothing is announced merely because the
  // screen mounted (the heading-focus effect below covers that instead).
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  /** Moves the cursor to `next` and announces what changed, from exactly one live region. */
  function moveTo(next: ReviewSession) {
    setSession(next);
    setAnnouncement(describeStepAnnouncement(next));
  }

  const move = lastMove(session);
  const currentMoveIndex = session.cursor > 0 ? session.cursor - 1 : null;
  // Only claimed at the final position (per Step 13), and only when the
  // record's `Result`/`ResultReason` tags actually say something - stepping
  // back off the end removes the claim, and a record with no result tags (or
  // `Result "*"`) never shows one at all. Never computed - `describeRecordedResult`
  // (via `recordedResultAt`) only quotes the file's own tags back, framed as
  // the record's claim. Shared with `describeStepAnnouncement` so the visible
  // text and the live-region announcement always agree.
  const recordedResult = recordedResultAt(session);

  return (
    <main className="app">
      <PieceSpriteDefs />
      <h1 className="app__title" tabIndex={-1} ref={headingRef}>
        Reviewing a game
      </h1>
      <button type="button" className="review-screen__back" onClick={onBack}>
        Back to start
      </button>
      <div className="review-status">
        <p className="review-status__position">
          {describeCurrentPosition(session)}
        </p>
        {recordedResult !== null && (
          <p className="review-status__result">{recordedResult}</p>
        )}
      </div>
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
            announcement={announcement}
          />
          <ReviewControls
            isAtStart={isAtStart(session)}
            isAtEnd={isAtEnd(session)}
            onJumpToStart={() => moveTo(jumpToStart(session))}
            onStepBack={() => moveTo(stepBack(session))}
            onStepForward={() => moveTo(stepForward(session))}
            onJumpToEnd={() => moveTo(jumpToEnd(session))}
          />
        </div>
        <MoveList
          moves={session.record.moves}
          currentMoveIndex={currentMoveIndex}
          onSelectMove={(moveIndex) => moveTo(jumpToMove(session, moveIndex))}
        />
      </div>
    </main>
  );
}

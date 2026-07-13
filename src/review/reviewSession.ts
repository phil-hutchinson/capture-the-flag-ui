// The review session - the reviewer's own state (story 00000014, Step 10).
//
// A `ReviewSession` is nothing more than a fully replayed recorded game
// (`ReplayedRecord`, `replay.ts`) plus a cursor into its positions. Every
// position the game ever occupied is already materialized by the replayer
// (`positions[0]` is the opening position; `positions[i]` is the position
// after `moves[i - 1]`), so the session is purely a cursor over data that
// already exists - it never re-applies or undoes a move, and it has no rule
// state of its own.
//
// Deliberately independent of `PlaySession`/`PlayState` (`playSession.ts`):
// those carry the rule state a *play* session needs (side to move, legal
// moves, draw offers, ...), none of which the reviewer has any business
// maintaining. The only "side to move" concept here is whatever the record
// itself says a given move's side was.
//
// Immutable, in the same style as the rest of the codebase: every operation
// returns a new session rather than mutating the one it is given. Cursor
// operations that would go out of range clamp to the nearest valid position
// rather than throwing - stepping back at the opening position and stepping
// forward at the final position are no-ops (they return a session equal to
// the one passed in).
//
// Player-facing wording of any substance lives in `reviewText.ts` (Step 6),
// not here - `describeCurrentPosition` below only assembles the structured
// input `reviewText.ts`'s `describePosition` needs.

import type { BoardState } from "../rules/primary/v1_1/gameState.ts";
import type {
  ReplayedPly,
  ReplayedRecord,
} from "../rules/primary/v1_1/replay.ts";
import { describePosition } from "./reviewText.ts";

/**
 * The reviewer's own state: the replayed game plus a cursor into its
 * positions. `cursor` indexes `record.positions` directly (and, one past,
 * `record.moves`): `0` is the opening position, and for `cursor > 0` the
 * position at `cursor` is the one after `record.moves[cursor - 1]` was made.
 */
export interface ReviewSession {
  readonly record: ReplayedRecord;
  readonly cursor: number;
}

/** Clamps `value` to the closed range `[min, max]`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Returns a new session with `cursor` clamped into range for `session.record`. */
function withCursor(session: ReviewSession, cursor: number): ReviewSession {
  const maxCursor = session.record.positions.length - 1;
  return { record: session.record, cursor: clamp(cursor, 0, maxCursor) };
}

/** Starts a review session at the opening position of `record`. */
export function createReviewSession(record: ReplayedRecord): ReviewSession {
  return { record, cursor: 0 };
}

/**
 * Steps one move forward. Clamps rather than throws: at the final position
 * this is a no-op, returning a session equal to the one passed in.
 */
export function stepForward(session: ReviewSession): ReviewSession {
  return withCursor(session, session.cursor + 1);
}

/**
 * Steps one move back. Clamps rather than throws: at the opening position
 * this is a no-op, returning a session equal to the one passed in.
 */
export function stepBack(session: ReviewSession): ReviewSession {
  return withCursor(session, session.cursor - 1);
}

/** Jumps to the opening position (before any move has been made). */
export function jumpToStart(session: ReviewSession): ReviewSession {
  return withCursor(session, 0);
}

/** Jumps to the final recorded position. */
export function jumpToEnd(session: ReviewSession): ReviewSession {
  return withCursor(session, session.record.positions.length - 1);
}

/**
 * Jumps to the position immediately after `record.moves[moveIndex]` - what
 * clicking a move in the move list does. `moveIndex` is a 0-based index into
 * `record.moves` (so `moveIndex === 0` lands on the position after the first
 * move, i.e. `cursor === 1`). Out-of-range indexes clamp rather than throw: a
 * negative index lands on the opening position, an index at or past the end
 * of the game lands on the final position.
 */
export function jumpToMove(
  session: ReviewSession,
  moveIndex: number,
): ReviewSession {
  return withCursor(session, moveIndex + 1);
}

/** The board to draw at the session's current cursor. */
export function currentBoard(session: ReviewSession): BoardState {
  return session.record.positions[session.cursor];
}

/** True when the cursor is at the opening position - there is no "last move" yet. */
export function isAtStart(session: ReviewSession): boolean {
  return session.cursor === 0;
}

/** True when the cursor is at the final recorded position. */
export function isAtEnd(session: ReviewSession): boolean {
  return session.cursor === session.record.positions.length - 1;
}

/**
 * The move that produced the current position - its token, round, side and
 * from/to squares (`ReplayedPly`, for the board's last-move highlight) - or
 * `null` at the opening position, where no move has been made yet.
 */
export function lastMove(session: ReviewSession): ReplayedPly | null {
  return isAtStart(session) ? null : session.record.moves[session.cursor - 1];
}

/**
 * A short player-facing description of where the cursor is in the game -
 * "Opening position" at the start, otherwise naming the move just made, its
 * round and its side. The wording itself lives in `reviewText.ts`'s
 * `describePosition`; this only gathers the structured input for it.
 */
export function describeCurrentPosition(session: ReviewSession): string {
  const move = lastMove(session);
  return describePosition({
    totalMoves: session.record.moves.length,
    move:
      move === null
        ? null
        : { ply: move.ply, round: move.round, side: move.side },
  });
}

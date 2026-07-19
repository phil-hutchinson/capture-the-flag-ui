// The move list (story 00000014, Step 12).
//
// The game's rounds as recorded - round number, red's move, blue's move -
// in the review screen's right-hand column, the same slot `Tray` occupies in
// the hot-seat layout. Each move is a plain button that jumps the review
// straight to the position *after* that move (`reviewSession.ts`'s
// `jumpToMove`, wired by `ReviewScreen.tsx`); the move currently shown is
// marked both visually (`.move-list__move--current`) and for assistive
// technology (`aria-current="step"`), and the list scrolls the current move
// into view as the player steps through with the controls (`ReviewControls`)
// so the highlight is never scrolled out of sight.
//
// Moves are shown in the record's own notation - `ReplayedPly.token`, the
// extended-form text straight out of the file (e.g. "A4-A5x") - rather than
// inventing a different one; per story.md, that notation is already
// player-facing (it names squares the same way the board's labels do).
//
// Every move is an ordinary `<button>`, so it is reachable and activatable by
// keyboard through the page's normal Tab order - no roving-tabindex grid is
// needed here (unlike the board), since there is no 2D navigation to support.

import { useEffect, useRef } from "react";
import "./MoveList.css";
import type { ReplayedPly } from "../rules/primary/v1/replay.ts";
import { sideColorName } from "../board/sideNames.ts";
import { moveLabel } from "./reviewText.ts";

export interface MoveListProps {
  /** The recorded game's moves, in order (`ReviewSession.record.moves`). */
  readonly moves: readonly ReplayedPly[];
  /**
   * 0-based index into `moves` of the move that produced the position
   * currently shown, or `null` at the opening position (before any move).
   */
  readonly currentMoveIndex: number | null;
  /** Jumps the review to the position after `moves[moveIndex]`. */
  readonly onSelectMove: (moveIndex: number) => void;
}

interface RoundSlot {
  readonly move: ReplayedPly;
  readonly index: number;
}

interface RoundEntry {
  readonly round: number;
  white: RoundSlot | null;
  black: RoundSlot | null;
}

/**
 * Groups the flat, ply-ordered move list into rounds - a red slot and a blue
 * slot per round, the last round's blue slot possibly empty (a game that
 * ends on red's move). Round numbers are already ascending and contiguous
 * per move (`recordFile.ts` rejects anything else), so a single pass
 * suffices.
 */
function groupIntoRounds(moves: readonly ReplayedPly[]): RoundEntry[] {
  const rounds: RoundEntry[] = [];
  for (const [index, move] of moves.entries()) {
    const last = rounds.at(-1);
    const round =
      last !== undefined && last.round === move.round
        ? last
        : { round: move.round, white: null, black: null };
    if (round !== last) {
      rounds.push(round);
    }
    if (move.side === "white") {
      round.white = { move, index };
    } else {
      round.black = { move, index };
    }
  }
  return rounds;
}

/** The move list: the recorded rounds, each move a button that jumps the review there. */
export function MoveList({
  moves,
  currentMoveIndex,
  onSelectMove,
}: MoveListProps) {
  const currentMoveRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    currentMoveRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentMoveIndex]);

  function renderSlot(slot: RoundSlot | null) {
    if (slot === null) {
      return <span className="move-list__move move-list__move--empty" />;
    }
    const isCurrent = slot.index === currentMoveIndex;
    const { move } = slot;
    return (
      <button
        type="button"
        ref={isCurrent ? currentMoveRef : undefined}
        className={
          isCurrent
            ? "move-list__move move-list__move--current"
            : "move-list__move"
        }
        aria-current={isCurrent ? "step" : undefined}
        aria-label={`${moveLabel(move.ply, move.round, move.side)} — ${move.token}`}
        onClick={() => onSelectMove(slot.index)}
      >
        {move.token}
      </button>
    );
  }

  const rounds = groupIntoRounds(moves);

  return (
    <div className="move-list">
      <div className="move-list__header" aria-hidden="true">
        <span className="move-list__round-number">Round</span>
        <span className="move-list__header-label">
          {sideColorName("white")}
        </span>
        <span className="move-list__header-label">
          {sideColorName("black")}
        </span>
      </div>
      <ol className="move-list__rounds" aria-label="Moves">
        {rounds.map((round) => (
          <li className="move-list__round" key={round.round}>
            <span className="move-list__round-number">{round.round}.</span>
            {renderSlot(round.white)}
            {renderSlot(round.black)}
          </li>
        ))}
      </ol>
    </div>
  );
}

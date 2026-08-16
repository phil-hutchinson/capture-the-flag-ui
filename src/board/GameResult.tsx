// End-of-game presentation (story 00000006, Step 9).
//
// Once a play session's result is no longer "ongoing", the caller renders
// this panel **instead of** `PlayStatus`, in that same status-bar slot above
// the board - a finished game has no "whose turn" to show.
//
// Story 00000036, Step 11 (implementation plan Decision 5): this component
// is now purely presentational. It used to call major 2's own
// `describeResult` itself; it now takes an already-composed **summary
// sentence** plus the outcome kind and the winning side (for its `data-`
// attributes and styling) - so no shared union of both ruleset majors' end
// reasons has to be invented here, and each major's own announcement module
// stays the one place that knows how to word its own endings. Major 2's
// callers (`HotSeatGame.tsx`, `EngineGame.tsx`) pass `playAnnouncement.ts`'s
// `describeResult(...)` output straight through, so the panel's words are
// word-for-word unchanged from before this step.
//
// Deliberately **visual only** - no live region of its own. The result is
// already announced exactly once, through the board's existing polite live
// region (Step 7); a second live region echoing the same sentence would
// double-speak it. And it never overlays or obscures the board: it lives in
// the status slot, above the board (same DOM position `PlayStatus`
// occupied), which keeps rendering - inert, per Step 6 - so the final
// position stays visible.
//
// Step 10 adds the "New game" action inside this panel: a full reset (a
// fresh, empty Phase-1 placement for both players, nothing carried over),
// offered only here because this panel is only ever rendered once the game
// has ended. Following `PlacementStatus.tsx`'s precedent, it's a plain
// `<button type="button">`, keyboard-reachable with a visible focus ring and
// an accessible name from its own text - no separate live-region
// announcement, for the same reason the result sentence above has none: a
// screen-reader user tabbing to a button hears its name and role from the
// button itself.

import { useEffect, useRef } from "react";
import type { ViewSide } from "./view/viewModel.ts";
import "./GameResult.css";

export interface GameResultProps {
  /** Whether the finished game was a win for `winner`, or a draw. */
  readonly outcomeKind: "win" | "draw";
  /** The winning side, or `null` for a draw. */
  readonly winner: ViewSide | null;
  /**
   * The already-composed, player-facing result sentence (e.g. "Red wins —
   * Flag captured."), from the caller's own major's announcement module -
   * `playAnnouncement.ts`'s `describeResult` for major 2. This panel renders
   * it verbatim; it does not compose or interpret it.
   */
  readonly summary: string;
  /** Starts a fresh game: empty Phase-1 placement for both players. */
  readonly onNewGame: () => void;
}

/** The end-of-game panel: the result and reason, replacing `PlayStatus` once the game is over. */
export function GameResult({
  outcomeKind,
  winner,
  summary,
  onNewGame,
}: GameResultProps) {
  const newGameRef = useRef<HTMLButtonElement>(null);

  // Peer-review fix (Major 2), with the owner's Gate-F decision on where
  // focus should land. The caller only ever renders `GameResult` once the
  // game has just ended, so this component mounts exactly once per ending.
  // Accepting a draw unmounts the Accept button that had focus, which would
  // otherwise strand focus on `<body>` and make the next Tab restart from the
  // top of the document; focus therefore moves here on mount.
  //
  // The target is the **New game button**, deliberately *not* the result
  // sentence: the result is already announced through the board's live region
  // (see this module's header), and focusing an element carrying that same
  // sentence would make a screen reader speak the result twice - which is
  // exactly what Step 16 (story 00000006) ruled out. A button announces only
  // its own name and role ("New game, button"), so the result is heard once.
  // Nothing is trapped: Tab/Shift+Tab move on from here as normal.
  useEffect(() => {
    newGameRef.current?.focus();
  }, []);

  return (
    <div
      className="game-result"
      data-outcome={outcomeKind}
      data-winner={winner ?? undefined}
    >
      <span className="game-result__summary">{summary}</span>
      <button
        type="button"
        className="game-result__new-game"
        onClick={onNewGame}
        ref={newGameRef}
      >
        New game
      </button>
    </div>
  );
}

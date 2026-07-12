// End-of-game presentation (story 00000006, Step 9).
//
// Once `playSession.play.result.kind !== "ongoing"`, `App.tsx` renders this
// panel **instead of** `PlayStatus`, in that same status-bar slot above the
// board - a finished game has no "whose turn" to show. It renders the
// result-and-reason sentence in player-facing terms (who won, red or blue,
// or that it is a draw, and why), reusing `describeResult`
// (`playAnnouncement.ts`) so the visual wording matches, word for word, what
// the board's live region already announced when the game ended.
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

import type { GameOutcome } from "../rules/primary/v1_1/outcome.ts";
import { describeResult } from "./playAnnouncement.ts";
import "./GameResult.css";

/** A finished `GameOutcome` - callers only render this panel once the game has ended. */
type FinishedOutcome = Exclude<GameOutcome, { readonly kind: "ongoing" }>;

export interface GameResultProps {
  readonly result: FinishedOutcome;
  /** Starts a fresh game: empty Phase-1 placement for both players. */
  readonly onNewGame: () => void;
}

/** The end-of-game panel: the result and reason, replacing `PlayStatus` once the game is over. */
export function GameResult({ result, onNewGame }: GameResultProps) {
  const winner = result.kind === "win" ? result.winner : null;
  return (
    <div
      className="game-result"
      data-outcome={result.kind}
      data-winner={winner ?? undefined}
    >
      <span className="game-result__summary">{describeResult(result)}</span>
      <button
        type="button"
        className="game-result__new-game"
        onClick={onNewGame}
      >
        New game
      </button>
    </div>
  );
}

// Phase 2 evolving game-record artifact (story 00000004, Step 10 — Gate E).
//
// Mirrors story 00000001's `SessionComplete.tsx` pattern: a developer-facing
// affordance, not a player-facing one, shown as a collapsed <details>
// disclosure (and, gated to dev builds, a console.log) rather than anything
// more elaborate. Where `SessionComplete` dumped the one-shot initial game
// state, this surfaces the *evolving* Phase-2 `PlayState` — the same
// `Ruleset` tag and position block, plus the move sequence in the simple
// `A2A3` coordinate form (rules.md §4.4) — re-rendered on every move via
// `play.ts`'s `renderGameRecord` (Step 3). This is the foundation
// recorded-game replay will build on; it does not implement replay itself.

import { useEffect, useMemo } from "react";
import {
  renderGameRecord,
  type PlayState,
} from "../rules/primary/v1_1/play.ts";
import "./GameRecord.css";

export interface GameRecordProps {
  /** The in-progress Phase-2 play state to render. */
  readonly play: PlayState;
}

export function GameRecord({ play }: GameRecordProps) {
  const record = useMemo(() => renderGameRecord(play), [play]);

  useEffect(() => {
    // Developer inspection path (the <details> dump below covers production).
    // Gated to dev builds so the artifact isn't logged in a shipped app.
    if (import.meta.env.DEV) {
      console.log("Game record:", record);
    }
  }, [record]);

  return (
    <details className="game-record">
      <summary>Developer: inspect game record</summary>
      <p className="game-record__hint">
        Ruleset <code>{play.ruleset}</code>. Updated after every move; also
        logged to the browser console.
      </p>
      <pre className="game-record__text">{record}</pre>
    </details>
  );
}

// Neutral "both armies ready" end state & inspectable game-state artifact
// (story 00000001, Step 11 — Gate E).
//
// Rendered once both players have confirmed a complete army
// (`session.active === null`, see placementSession.ts). This is the story's
// terminal, *neutral* state: it must reveal neither player's layout (the
// reveal belongs to Phase 2, out of scope here), so it never renders a
// `Board` or either side's raw `PlacementState` to the player.
//
// Its second job is to produce and surface the versioned initial game-state
// artifact (Step 5's `buildInitialGameState`/`RULESET_TAG`) that Phase 2 and
// recorded-game replay will build on. That artifact is a developer-facing
// affordance, not a player-facing one, so it is shown as a raw JSON dump
// (plus the position-block text render) behind a collapsed <details>
// disclosure, and also logged to the console — both are "at minimum a JSON
// dump the owner can view/copy" per the story, nothing more elaborate.

import { useEffect, useMemo } from "react";
import {
  buildInitialGameState,
  renderPositionBlock,
} from "../rules/primary/v1_1/gameState.ts";
import type { PlacementState } from "../rules/primary/v1_1/placement.ts";
import "./SessionComplete.css";

export interface SessionCompleteProps {
  /** White's final, completed placement (Step 3's `isComplete`). */
  readonly white: PlacementState;
  /** Black's final, completed placement (Step 3's `isComplete`). */
  readonly black: PlacementState;
}

export function SessionComplete({ white, black }: SessionCompleteProps) {
  // Both placements are already complete by the time the session reaches
  // this state (confirmActive rejects an incomplete army), so this never
  // throws in practice; buildInitialGameState still enforces it structurally.
  const gameState = useMemo(
    () => buildInitialGameState(white, black),
    [white, black],
  );
  const positionBlock = useMemo(
    () => renderPositionBlock(gameState),
    [gameState],
  );
  const json = useMemo(() => JSON.stringify(gameState, null, 2), [gameState]);

  useEffect(() => {
    // Developer inspection path (the <details> dump covers production). Gated
    // to dev builds so the artifact isn't logged in a shipped app.
    if (import.meta.env.DEV) {
      console.log("Initial game state:", gameState);
    }
  }, [gameState]);

  return (
    <div className="session-complete">
      <p className="session-complete__notice">
        Both players have placed their armies. Setup is complete.
      </p>
      <details className="session-complete__artifact">
        <summary>Developer: inspect initial game state</summary>
        <p className="session-complete__hint">
          Ruleset <code>{gameState.ruleset}</code>. The full board (both armies)
          is also logged to the browser console.
        </p>
        <pre className="session-complete__position-block">{positionBlock}</pre>
        <textarea
          className="session-complete__json"
          readOnly
          value={json}
          rows={16}
          aria-label="Initial game state, as JSON"
        />
      </details>
    </div>
  );
}

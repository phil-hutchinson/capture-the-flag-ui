// Two-player placement session (story 00000001, Step 10).
//
// This module has no React dependency: it is a small, pure orchestration
// layer on top of the per-player `PlacementState` model (Step 3). It tracks
// both players' in-progress (or confirmed) placements and whose turn it
// currently is - White first, then Black - so the UI can drive a single
// hot-seat flow instead of hardcoding one active side.
//
// Confirming the active player's army *is* the hand-off: it advances
// `active` to the other side without altering that side's own placement (it
// starts, and stays, empty until that player begins placing). Once Black
// also confirms, `active` becomes `null` - there is no third player to hand
// off to. Building the neutral "both armies ready" end state and the
// serialized artifact from that terminal state is Step 11's scope, not this
// module's; this module only exposes the fact that the session has reached
// it (`active === null`) plus both sides' final `PlacementState`s.

import {
  emptyPlacement,
  isComplete,
  type PlacementState,
} from "../rules/primary/v1_1/placement.ts";
import type { Side } from "../rules/primary/v1_1/board.ts";

/**
 * The placement session's state: both players' placements, and whose turn it
 * is. `active` is `null` once both players have confirmed a complete army -
 * there is nobody left to hand off to.
 */
export interface PlacementSession {
  readonly active: Side | null;
  readonly white: PlacementState;
  readonly black: PlacementState;
}

/** A fresh session: White goes first, both trays full and boards empty. */
export function newSession(): PlacementSession {
  return {
    active: "white",
    white: emptyPlacement("white"),
    black: emptyPlacement("black"),
  };
}

/** True once both players have confirmed - there is no active player left. */
export function isSessionComplete(session: PlacementSession): boolean {
  return session.active === null;
}

/**
 * The active player's own `PlacementState`. Throws if the session is already
 * complete (there is no active player to read).
 */
export function activePlacement(session: PlacementSession): PlacementState {
  if (session.active === null) {
    throw new Error(
      "Cannot read the active placement: both players have already confirmed.",
    );
  }
  return session[session.active];
}

/**
 * Replaces the active player's placement with `update(currentPlacement)`,
 * leaving the other (inactive) player's placement untouched. Throws if the
 * session is already complete.
 */
export function updateActivePlacement(
  session: PlacementSession,
  update: (state: PlacementState) => PlacementState,
): PlacementSession {
  const side = session.active;
  if (side === null) {
    throw new Error(
      "Cannot update the active placement: both players have already confirmed.",
    );
  }
  return { ...session, [side]: update(session[side]) };
}

/**
 * Confirms the active player's army and hands off to the next player: White
 * confirming makes Black active (Black's board starts, and stays, empty
 * until Black places on it); Black confirming leaves nobody active
 * (`active` becomes `null`) - the session is then complete. Throws if the
 * session is already complete, or if the active player's army is not yet
 * complete (`isComplete` from Step 3).
 */
export function confirmActive(session: PlacementSession): PlacementSession {
  const side = session.active;
  if (side === null) {
    throw new Error("Cannot confirm: both players have already confirmed.");
  }
  if (!isComplete(session[side])) {
    throw new Error(`Cannot confirm: ${side}'s army is not yet complete.`);
  }
  const next: Side | null = side === "white" ? "black" : null;
  return { ...session, active: next };
}

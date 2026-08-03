import { describe, expect, it } from "vitest";
import {
  activePlacement,
  confirmActive,
  isSessionComplete,
  newSession,
  updateActivePlacement,
} from "./placementSession.ts";
import {
  autoFill,
  place,
  type PlacementState,
} from "../rules/primary/v2/placement.ts";
import { homeSquares } from "../rules/primary/v2/board.ts";
import { BATTLE_EDITION } from "../rules/primary/v2/edition.ts";

/**
 * `autoFill`, unwrapped (story 00000025's Step 8 changed its return type to
 * an `AutoFillResult` reporting exhaustion instead of throwing). Every
 * fixture below is a fresh Battle board, so none is expected to exhaust.
 */
function autoFillOrThrow(state: PlacementState): PlacementState {
  const result = autoFill(state);
  if (!result.ok) {
    throw new Error(
      "autoFillOrThrow: autoFill reported no legal arrangement, but this test expected one to exist.",
    );
  }
  return result.state;
}

describe("newSession", () => {
  it("starts with White active and both boards empty", () => {
    const session = newSession(BATTLE_EDITION);
    expect(session.active).toBe("white");
    expect(session.white.placements.size).toBe(0);
    expect(session.black.placements.size).toBe(0);
    expect(isSessionComplete(session)).toBe(false);
  });
});

describe("activePlacement", () => {
  it("reads the active player's own placement", () => {
    const session = newSession(BATTLE_EDITION);
    expect(activePlacement(session)).toBe(session.white);
  });

  it("throws once the session is complete", () => {
    let session = newSession(BATTLE_EDITION);
    session = updateActivePlacement(session, autoFillOrThrow);
    session = confirmActive(session); // White confirms, Black becomes active
    session = updateActivePlacement(session, autoFillOrThrow);
    session = confirmActive(session); // Black confirms, session complete
    expect(() => activePlacement(session)).toThrow();
  });
});

describe("updateActivePlacement", () => {
  it("only changes the active side's placement, never the inactive side's", () => {
    const session = newSession(BATTLE_EDITION);
    const square = homeSquares("white")[0];
    const next = updateActivePlacement(session, (state) =>
      place(state, square, "champion"),
    );
    expect(next.white.placements.size).toBe(1);
    expect(next.black).toBe(session.black);
  });

  it("throws once the session is complete", () => {
    let session = newSession(BATTLE_EDITION);
    session = updateActivePlacement(session, autoFillOrThrow);
    session = confirmActive(session);
    session = updateActivePlacement(session, autoFillOrThrow);
    session = confirmActive(session);
    expect(() => updateActivePlacement(session, autoFillOrThrow)).toThrow();
  });
});

describe("confirmActive", () => {
  it("rejects confirming an incomplete army", () => {
    const session = newSession(BATTLE_EDITION);
    expect(() => confirmActive(session)).toThrow();
  });

  it("hands off from White to Black on White's confirm, leaving Black's board empty", () => {
    let session = newSession(BATTLE_EDITION);
    session = updateActivePlacement(session, autoFillOrThrow);
    const whiteFilled = session.white;
    session = confirmActive(session);

    expect(session.active).toBe("black");
    expect(session.white).toBe(whiteFilled);
    expect(session.black.placements.size).toBe(0);
    expect(isSessionComplete(session)).toBe(false);
  });

  it("completes the session (active becomes null) once Black also confirms", () => {
    let session = newSession(BATTLE_EDITION);
    session = updateActivePlacement(session, autoFillOrThrow);
    session = confirmActive(session);
    session = updateActivePlacement(session, autoFillOrThrow);
    session = confirmActive(session);

    expect(session.active).toBeNull();
    expect(isSessionComplete(session)).toBe(true);
  });

  it("throws when confirming an already-complete session", () => {
    let session = newSession(BATTLE_EDITION);
    session = updateActivePlacement(session, autoFillOrThrow);
    session = confirmActive(session);
    session = updateActivePlacement(session, autoFillOrThrow);
    session = confirmActive(session);
    expect(() => confirmActive(session)).toThrow();
  });
});

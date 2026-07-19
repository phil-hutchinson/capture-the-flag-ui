import { describe, expect, it } from "vitest";
import {
  activePlacement,
  confirmActive,
  isSessionComplete,
  newSession,
  updateActivePlacement,
} from "./placementSession.ts";
import { autoFill, place } from "../rules/primary/v1/placement.ts";
import { homeSquares } from "../rules/primary/v1/board.ts";

describe("newSession", () => {
  it("starts with White active and both boards empty", () => {
    const session = newSession();
    expect(session.active).toBe("white");
    expect(session.white.placements.size).toBe(0);
    expect(session.black.placements.size).toBe(0);
    expect(isSessionComplete(session)).toBe(false);
  });
});

describe("activePlacement", () => {
  it("reads the active player's own placement", () => {
    const session = newSession();
    expect(activePlacement(session)).toBe(session.white);
  });

  it("throws once the session is complete", () => {
    let session = newSession();
    session = updateActivePlacement(session, (state) => autoFill(state));
    session = confirmActive(session); // White confirms, Black becomes active
    session = updateActivePlacement(session, (state) => autoFill(state));
    session = confirmActive(session); // Black confirms, session complete
    expect(() => activePlacement(session)).toThrow();
  });
});

describe("updateActivePlacement", () => {
  it("only changes the active side's placement, never the inactive side's", () => {
    const session = newSession();
    const square = homeSquares("white")[0];
    const next = updateActivePlacement(session, (state) =>
      place(state, square, "sapper"),
    );
    expect(next.white.placements.size).toBe(1);
    expect(next.black).toBe(session.black);
  });

  it("throws once the session is complete", () => {
    let session = newSession();
    session = updateActivePlacement(session, (state) => autoFill(state));
    session = confirmActive(session);
    session = updateActivePlacement(session, (state) => autoFill(state));
    session = confirmActive(session);
    expect(() =>
      updateActivePlacement(session, (state) => autoFill(state)),
    ).toThrow();
  });
});

describe("confirmActive", () => {
  it("rejects confirming an incomplete army", () => {
    const session = newSession();
    expect(() => confirmActive(session)).toThrow();
  });

  it("hands off from White to Black on White's confirm, leaving Black's board empty", () => {
    let session = newSession();
    session = updateActivePlacement(session, (state) => autoFill(state));
    const whiteFilled = session.white;
    session = confirmActive(session);

    expect(session.active).toBe("black");
    expect(session.white).toBe(whiteFilled);
    expect(session.black.placements.size).toBe(0);
    expect(isSessionComplete(session)).toBe(false);
  });

  it("completes the session (active becomes null) once Black also confirms", () => {
    let session = newSession();
    session = updateActivePlacement(session, (state) => autoFill(state));
    session = confirmActive(session);
    session = updateActivePlacement(session, (state) => autoFill(state));
    session = confirmActive(session);

    expect(session.active).toBeNull();
    expect(isSessionComplete(session)).toBe(true);
  });

  it("throws when confirming an already-complete session", () => {
    let session = newSession();
    session = updateActivePlacement(session, (state) => autoFill(state));
    session = confirmActive(session);
    session = updateActivePlacement(session, (state) => autoFill(state));
    session = confirmActive(session);
    expect(() => confirmActive(session)).toThrow();
  });
});

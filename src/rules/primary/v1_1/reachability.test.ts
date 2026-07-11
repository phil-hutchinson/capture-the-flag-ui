import { describe, expect, it } from "vitest";
import type { BoardState, PlacedPiece } from "./gameState.ts";
import { computeUnbreachableFlagInputs } from "./reachability.ts";
import type { PieceTypeId } from "./pieces.ts";

/** Builds a `BoardState` from a list of `[squareKey, side, pieceType]` triples. */
function board(
  pieces: readonly [string, PlacedPiece["side"], PieceTypeId][],
): BoardState {
  const result: Record<string, PlacedPiece> = {};
  for (const [key, side, pieceType] of pieces) {
    result[key] = { side, pieceType };
  }
  return result;
}

describe("computeUnbreachableFlagInputs - Flag enclosure", () => {
  it("reports a Flag walled into a corner by its own Towers as enclosed", () => {
    // White Flag at A1, sealed off from the rest of the board by Towers at
    // A2 and B1 (the board edge does the rest in a corner).
    const state = board([
      ["A1", "white", "flag"],
      ["A2", "white", "tower"],
      ["B1", "white", "tower"],
    ]);
    expect(computeUnbreachableFlagInputs(state).whiteFlagEnclosed).toBe(true);
  });

  it("reports the same Flag as not enclosed once one wall Tower is removed", () => {
    // Same as above but A2's Tower is gone: A1 -> A2 -> ... -> A9 (Black
    // home) is now an open orthogonal path.
    const state = board([
      ["A1", "white", "flag"],
      ["B1", "white", "tower"],
    ]);
    expect(computeUnbreachableFlagInputs(state).whiteFlagEnclosed).toBe(false);
  });

  it("reports a Flag standing in the open as not enclosed", () => {
    const state = board([["F5", "white", "flag"]]);
    expect(computeUnbreachableFlagInputs(state).whiteFlagEnclosed).toBe(false);
  });

  it("reports a side with no Flag on the board as not enclosed, without throwing", () => {
    const state = board([["B1", "white", "tower"]]);
    expect(() => computeUnbreachableFlagInputs(state)).not.toThrow();
    expect(computeUnbreachableFlagInputs(state).whiteFlagEnclosed).toBe(false);
  });

  it("computes both sides' enclosure independently", () => {
    const state = board([
      ["A1", "white", "flag"],
      ["A2", "white", "tower"],
      ["B1", "white", "tower"],
      ["L12", "black", "flag"],
    ]);
    const inputs = computeUnbreachableFlagInputs(state);
    expect(inputs.whiteFlagEnclosed).toBe(true);
    expect(inputs.blackFlagEnclosed).toBe(false);
  });
});

describe("computeUnbreachableFlagInputs - Sapper availability", () => {
  it("reports a Sapper sealed behind its own side's Towers, with no path to any enemy Tower, as unavailable", () => {
    // White Sapper at A1, sealed into a corner pocket by Towers at A2 and
    // B1: no orthogonal path anywhere else on the board.
    const state = board([
      ["A1", "white", "sapper"],
      ["A2", "white", "tower"],
      ["B1", "white", "tower"],
      ["L12", "black", "tower"],
    ]);
    expect(computeUnbreachableFlagInputs(state).whiteSappersAvailable).toBe(
      false,
    );
  });

  it("reports the same Sapper as available once one of those Towers is removed", () => {
    const state = board([
      ["A1", "white", "sapper"],
      ["B1", "white", "tower"],
      ["L12", "black", "tower"],
    ]);
    expect(computeUnbreachableFlagInputs(state).whiteSappersAvailable).toBe(
      true,
    );
  });

  it("reports a side with zero Sappers as having none available", () => {
    const state = board([
      ["A1", "white", "militia"],
      ["L12", "black", "tower"],
    ]);
    expect(computeUnbreachableFlagInputs(state).whiteSappersAvailable).toBe(
      false,
    );
  });

  it("treats an enemy Tower as reachable as a target even though Towers are walls", () => {
    // Sapper orthogonally adjacent to an enemy Tower: it never needs to step
    // onto or past the Tower, only to arrive there.
    const state = board([
      ["D5", "white", "sapper"],
      ["D6", "black", "tower"],
    ]);
    expect(computeUnbreachableFlagInputs(state).whiteSappersAvailable).toBe(
      true,
    );
  });

  it("does not let mobile pieces block a Sapper's path", () => {
    // A wall of enemy Militia between the Sapper and an enemy Tower - mobile
    // pieces are ignored entirely for structural reachability.
    const state = board([
      ["A1", "white", "sapper"],
      ["A2", "black", "militia"],
      ["A3", "black", "militia"],
      ["A4", "black", "militia"],
      ["A5", "black", "tower"],
    ]);
    expect(computeUnbreachableFlagInputs(state).whiteSappersAvailable).toBe(
      true,
    );
  });

  it("lets a lake block a Sapper's only path to an enemy Tower", () => {
    // Row 6 is fully impassable: its lake columns (B, C, F, G, J, K) are
    // naturally walls, and Towers seal the remaining non-lake columns (A, D,
    // E, H, I, L). A Sapper south of row 6 has no orthogonal route north to a
    // Tower beyond it - the lake squares are pulling real weight here (only
    // 6 of the 12 columns needed an explicit Tower).
    const state = board([
      ["A1", "white", "sapper"],
      ["A6", "white", "tower"],
      ["D6", "white", "tower"],
      ["E6", "white", "tower"],
      ["H6", "white", "tower"],
      ["I6", "white", "tower"],
      ["L6", "white", "tower"],
      ["A12", "black", "tower"],
    ]);
    expect(computeUnbreachableFlagInputs(state).whiteSappersAvailable).toBe(
      false,
    );
  });

  it("computes both sides' Sapper availability independently", () => {
    // White Sapper sealed into a corner (unavailable); Black Sapper with a
    // clear column straight down to a White Tower (available).
    const state = board([
      ["A1", "white", "sapper"],
      ["A2", "white", "tower"],
      ["B1", "white", "tower"],
      ["L12", "black", "sapper"],
      ["L1", "white", "tower"],
    ]);
    const inputs = computeUnbreachableFlagInputs(state);
    expect(inputs.whiteSappersAvailable).toBe(false);
    expect(inputs.blackSappersAvailable).toBe(true);
  });
});

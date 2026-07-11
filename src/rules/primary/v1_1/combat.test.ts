import { describe, expect, it } from "vitest";
import type { Square } from "./board.ts";
import type { BoardState, PlacedPiece } from "./gameState.ts";
import { resolveCombat } from "./combat.ts";
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

const D5: Square = { column: "D", row: 5 };
const D6: Square = { column: "D", row: 6 };
const D7: Square = { column: "D", row: 7 };
const D8: Square = { column: "D", row: 8 };

describe("resolveCombat (ruleset PRIMARY:1.1, base rank table & non-Archer special cases)", () => {
  it("has the lower-numbered attacker win against a higher-numbered defender", () => {
    const state = board([
      ["D5", "white", "champion"], // rank 2
      ["D6", "black", "infantry"], // rank 4
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerWins");
    expect(outcome.capture).toBe(true);
    expect(outcome.archerSupport).toBe(false);
    expect(outcome.attacker).toEqual({ side: "white", pieceType: "champion" });
    expect(outcome.defender).toEqual({ side: "black", pieceType: "infantry" });
    expect(outcome.square).toEqual(D6);
  });

  it("has the higher-numbered attacker lose against a lower-numbered defender (a sacrifice)", () => {
    const state = board([
      ["D5", "white", "infantry"], // rank 4
      ["D6", "black", "champion"], // rank 2
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerLoses");
    expect(outcome.capture).toBe(false);
    expect(outcome.archerSupport).toBe(false);
  });

  it("is mutual loss between two equal-rank pieces (rank 4)", () => {
    const state = board([
      ["D5", "white", "infantry"],
      ["D6", "black", "infantry"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("mutualLoss");
    expect(outcome.capture).toBe(true);
    expect(outcome.archerSupport).toBe(false);
  });

  it("is mutual loss between two equal-rank pieces (rank 6)", () => {
    const state = board([
      ["D5", "white", "militia"],
      ["D6", "black", "militia"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("mutualLoss");
    expect(outcome.capture).toBe(true);
  });

  it("has a Knight charge (distance 2) against a Knight win outright", () => {
    const state = board([
      ["D5", "white", "knight"],
      ["D7", "black", "knight"],
    ]);
    const outcome = resolveCombat(state, D5, D7);
    expect(outcome.result).toBe("attackerWins");
    expect(outcome.capture).toBe(true);
  });

  it("has a Knight charge (distance 3) against a Knight win outright", () => {
    const state = board([
      ["D5", "white", "knight"],
      ["D8", "black", "knight"],
    ]);
    const outcome = resolveCombat(state, D5, D8);
    expect(outcome.result).toBe("attackerWins");
  });

  it("is mutual loss for an adjacent (non-charge) Knight-vs-Knight attack", () => {
    const state = board([
      ["D5", "white", "knight"],
      ["D6", "black", "knight"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("mutualLoss");
  });

  it("has an adjacent Knight attack on a Halberdier win normally (rank 3 over rank 5)", () => {
    const state = board([
      ["D5", "white", "knight"],
      ["D6", "black", "halberdier"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerWins");
    expect(outcome.capture).toBe(true);
  });

  it("has an attacking Assassin win against a numbered piece", () => {
    const state = board([
      ["D5", "white", "assassin"],
      ["D6", "black", "infantry"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerWins");
  });

  it("has an attacking Assassin win against a stronger (lower-ranked) piece", () => {
    const state = board([
      ["D5", "white", "assassin"],
      ["D6", "black", "lordMarshal"], // rank 1
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerWins");
  });

  it("has an attacking Assassin win against another Assassin", () => {
    const state = board([
      ["D5", "white", "assassin"],
      ["D6", "black", "assassin"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerWins");
  });

  it("has an attacking Assassin lose against a Tower (the guaranteed win does not extend to Towers)", () => {
    const state = board([
      ["D5", "white", "assassin"],
      ["D6", "black", "tower"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerLoses");
    expect(outcome.capture).toBe(false);
  });

  it("has a numbered piece attacking an Assassin win (the Assassin always loses when attacked)", () => {
    const state = board([
      ["D5", "white", "infantry"],
      ["D6", "black", "assassin"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerWins");
    expect(outcome.capture).toBe(true);
  });

  it("has a Sapper attacking an Assassin win (the Assassin always loses when attacked)", () => {
    const state = board([
      ["D5", "white", "sapper"],
      ["D6", "black", "assassin"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerWins");
  });

  it("has a Sapper destroy a Tower (attacker wins)", () => {
    const state = board([
      ["D5", "white", "sapper"],
      ["D6", "black", "tower"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerWins");
    expect(outcome.capture).toBe(true);
  });

  it("has a non-Sapper (Militia) attacking a Tower lose (a complete sacrifice, Tower stands)", () => {
    const state = board([
      ["D5", "white", "militia"],
      ["D6", "black", "tower"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerLoses");
    expect(outcome.capture).toBe(false);
  });

  it("has a non-Sapper (Champion) attacking a Tower lose (a complete sacrifice, Tower stands)", () => {
    const state = board([
      ["D5", "white", "champion"],
      ["D6", "black", "tower"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerLoses");
    expect(outcome.capture).toBe(false);
  });
});

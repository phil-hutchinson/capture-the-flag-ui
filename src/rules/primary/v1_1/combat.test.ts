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

const C4: Square = { column: "C", row: 4 };
const C5: Square = { column: "C", row: 5 }; // one step beyond, C6, is a lake square
const D3: Square = { column: "D", row: 3 };
const D4: Square = { column: "D", row: 4 };
const D11: Square = { column: "D", row: 11 };
const D12: Square = { column: "D", row: 12 };

describe("resolveCombat (ruleset PRIMARY:1.1, Archer defensive support)", () => {
  it("flips an ordinary 1-square attacker-wins result to mutual loss when a friendly Archer stands directly behind the defender", () => {
    const state = board([
      ["D5", "white", "champion"], // rank 2
      ["D6", "black", "infantry"], // rank 4, would lose outright
      ["D7", "black", "archer"], // one square beyond D6 on the attack line
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("mutualLoss");
    expect(outcome.capture).toBe(true);
    expect(outcome.archerSupport).toBe(true);
  });

  it("flips a Knight charge (distance 2) attacker-wins result to mutual loss with the same trigger-square geometry", () => {
    const state = board([
      ["D4", "white", "knight"], // rank 3
      ["D6", "black", "halberdier"], // rank 5, would lose outright
      ["D7", "black", "archer"], // one square beyond D6, continuing the charge's direction of travel
    ]);
    const outcome = resolveCombat(state, D4, D6);
    expect(outcome.result).toBe("mutualLoss");
    expect(outcome.archerSupport).toBe(true);
  });

  it("flips a Skirmisher rush (distance 3) attacker-wins result to mutual loss with the same trigger-square geometry", () => {
    const state = board([
      ["D3", "white", "skirmisher"], // rank 7
      ["D6", "black", "sapper"], // rank 9, would lose outright
      ["D7", "black", "archer"], // one square beyond D6, continuing the rush's direction of travel
    ]);
    const outcome = resolveCombat(state, D3, D6);
    expect(outcome.result).toBe("mutualLoss");
    expect(outcome.archerSupport).toBe(true);
  });

  it("extends support to a supported Tower, trading it with the Sapper demolishing it", () => {
    const state = board([
      ["D5", "white", "sapper"],
      ["D6", "black", "tower"],
      ["D7", "black", "archer"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("mutualLoss");
    expect(outcome.capture).toBe(true);
    expect(outcome.archerSupport).toBe(true);
  });

  it("does not make an attacking Assassin immune to support (mutual loss, the Assassin also falls)", () => {
    const state = board([
      ["D5", "white", "assassin"],
      ["D6", "black", "infantry"],
      ["D7", "black", "archer"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("mutualLoss");
    expect(outcome.archerSupport).toBe(true);
  });

  it("does not fire when the friendly Archer is adjacent to the defender but off the attack line", () => {
    const state = board([
      ["D5", "white", "champion"],
      ["D6", "black", "infantry"],
      ["C6", "black", "archer"], // adjacent to the defender, but not on the D5->D6 line
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerWins");
    expect(outcome.archerSupport).toBe(false);
  });

  it("does not fire when the trigger square is off-board", () => {
    const state = board([
      ["D11", "white", "champion"],
      ["D12", "black", "infantry"], // the board's last row - one step further doesn't exist
    ]);
    const outcome = resolveCombat(state, D11, D12);
    expect(outcome.result).toBe("attackerWins");
    expect(outcome.archerSupport).toBe(false);
  });

  it("does not fire when the trigger square is a lake", () => {
    const state = board([
      ["C4", "white", "champion"],
      ["C5", "black", "infantry"], // one step beyond, C6, is a lake square
    ]);
    const outcome = resolveCombat(state, C4, C5);
    expect(outcome.result).toBe("attackerWins");
    expect(outcome.archerSupport).toBe(false);
  });

  it("does not fire when the piece on the trigger square is an Archer of the attacker's side", () => {
    const state = board([
      ["D5", "white", "champion"],
      ["D6", "black", "infantry"],
      ["D7", "white", "archer"], // the attacker's own Archer, not the defender's
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerWins");
    expect(outcome.archerSupport).toBe(false);
  });

  it("does not evaluate support when the base result is already attacker-loses", () => {
    const state = board([
      ["D5", "white", "infantry"], // rank 4
      ["D6", "black", "champion"], // rank 2, wins outright
      ["D7", "black", "archer"], // present, but support only helps a losing defense
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerLoses");
    expect(outcome.archerSupport).toBe(false);
  });

  it("does not evaluate support when the base result is already mutual loss", () => {
    const state = board([
      ["D5", "white", "infantry"],
      ["D6", "black", "infantry"], // equal rank, mutual loss regardless
      ["D7", "black", "archer"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("mutualLoss");
    expect(outcome.archerSupport).toBe(false);
  });
});

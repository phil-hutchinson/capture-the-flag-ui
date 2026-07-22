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

// Fixtures below use only pieces whose id and rank are identical in both the
// 1.1 and 1.2 rosters (champion rank 2, knight rank 3, militia rank 6, tower,
// flag) - see the implementation plan's cross-step test constraint - since
// the roster swap itself is Step 5.

describe("resolveCombat (ruleset 1.2, base rank table)", () => {
  it("has the lower-numbered attacker win against a higher-numbered defender", () => {
    const state = board([
      ["D5", "white", "champion"], // rank 2
      ["D6", "black", "militia"], // rank 6
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerWins");
    expect(outcome.capture).toBe(true);
    expect(outcome.attacker).toEqual({ side: "white", pieceType: "champion" });
    expect(outcome.defender).toEqual({ side: "black", pieceType: "militia" });
    expect(outcome.square).toEqual(D6);
  });

  it("has the higher-numbered attacker lose against a lower-numbered defender (a sacrifice)", () => {
    const state = board([
      ["D5", "white", "militia"], // rank 6
      ["D6", "black", "champion"], // rank 2
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerLoses");
    expect(outcome.capture).toBe(false);
  });

  it("is mutual loss between two equal-rank pieces (rank 3)", () => {
    const state = board([
      ["D5", "white", "knight"],
      ["D6", "black", "knight"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("mutualLoss");
    expect(outcome.capture).toBe(true);
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
});

describe("resolveCombat (ruleset 1.2, Tower trade and Flag capture)", () => {
  it("has any piece attacking a Tower trade with it (mutual loss)", () => {
    const state = board([
      ["D5", "white", "militia"], // rank 6, weakest ranked piece
      ["D6", "black", "tower"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("mutualLoss");
    expect(outcome.capture).toBe(true);
  });

  it("has a strong piece attacking a Tower still trade with it (mutual loss, no rank privilege)", () => {
    const state = board([
      ["D5", "white", "champion"], // rank 2, strongest available fixture
      ["D6", "black", "tower"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("mutualLoss");
    expect(outcome.capture).toBe(true);
  });

  it("has any piece attacking the Flag win outright, no rank comparison", () => {
    const state = board([
      ["D5", "white", "militia"],
      ["D6", "black", "flag"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerWins");
    expect(outcome.capture).toBe(true);
  });

  it("has a strong piece attacking the Flag win outright too", () => {
    const state = board([
      ["D5", "white", "champion"],
      ["D6", "black", "flag"],
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerWins");
    expect(outcome.capture).toBe(true);
  });
});

describe("resolveCombat (ruleset 1.2, formation bonus)", () => {
  it("turns a one-rank-weaker attacker's clean loss into a mutual loss when it has an adjacent equal-rank ally", () => {
    const state = board([
      ["D5", "white", "knight"], // rank 3, one rank weaker than the defender
      ["D6", "black", "champion"], // rank 2
      ["C5", "white", "knight"], // adjacent (diagonal) ally, equal rank to the attacker
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("mutualLoss");
    expect(outcome.capture).toBe(true);
  });

  it("without the ally, the same one-rank-weaker attacker simply loses", () => {
    const state = board([
      ["D5", "white", "knight"], // rank 3
      ["D6", "black", "champion"], // rank 2
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerLoses");
    expect(outcome.capture).toBe(false);
  });

  it("turns a one-rank-weaker defender's clean capture into a mutual loss when it has an adjacent equal-rank ally", () => {
    const state = board([
      ["D5", "white", "champion"], // rank 2
      ["D6", "black", "knight"], // rank 3, one rank weaker than the attacker
      ["E6", "black", "knight"], // adjacent ally, equal rank to the defender
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("mutualLoss");
    expect(outcome.capture).toBe(true);
  });

  it("without the ally, the same one-rank-weaker defender is simply captured", () => {
    const state = board([
      ["D5", "white", "champion"], // rank 2
      ["D6", "black", "knight"], // rank 3
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerWins");
    expect(outcome.capture).toBe(true);
  });

  it("judges the attacker's formation from its origin square, before the move - an ally beside only the defender's square does not count", () => {
    // D7 is adjacent to the defender's square (D6) but not to the
    // attacker's origin (D5) - since formation is judged for the attacker
    // from `from`, this ally (of the attacker's own side) does not grant it.
    const state = board([
      ["D5", "white", "knight"], // rank 3, one rank weaker than the defender
      ["D6", "black", "champion"], // rank 2
      ["D7", "white", "knight"], // adjacent to D6, not to D5
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerLoses");
  });

  it("does not apply formation when the rank gap is zero (equal rank stays a plain mutual loss)", () => {
    const state = board([
      ["D5", "white", "militia"],
      ["D6", "black", "militia"],
      ["C5", "white", "militia"], // adjacent equal-rank ally to the attacker
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("mutualLoss");
  });

  it("does not apply formation when the rank gap is two or more, even with an adjacent equal-rank ally", () => {
    const state = board([
      ["D5", "white", "champion"], // rank 2
      ["D6", "black", "militia"], // rank 6, a four-rank gap
      ["E6", "black", "militia"], // adjacent equal-rank ally to the defender
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerWins");
    expect(outcome.capture).toBe(true);
  });

  it("does not apply formation to a Tower defender (the Tower trade always fires regardless of any adjacent piece)", () => {
    const state = board([
      ["D5", "white", "militia"],
      ["D6", "black", "tower"],
      ["E6", "black", "militia"], // adjacent to the Tower, irrelevant - Towers have no rank
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("mutualLoss");
  });

  it("does not apply formation to a Flag defender (capturing the Flag always wins outright)", () => {
    const state = board([
      ["D5", "white", "champion"], // one rank stronger than a knight would be, but irrelevant here
      ["D6", "black", "flag"],
      ["E6", "black", "knight"], // adjacent, irrelevant - the Flag has no rank
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerWins");
  });

  it("recognises an orthogonally adjacent ally, not only a diagonal one", () => {
    const state = board([
      ["D5", "white", "knight"], // rank 3
      ["D6", "black", "champion"], // rank 2
      ["D4", "white", "knight"], // orthogonally adjacent ally to the attacker's origin
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("mutualLoss");
  });

  it("does not grant formation from an ally two squares away", () => {
    const state = board([
      ["D5", "white", "knight"], // rank 3
      ["D6", "black", "champion"], // rank 2
      ["D3", "white", "knight"], // two squares from D5 - not adjacent
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerLoses");
  });

  it("does not grant formation from an enemy piece of equal rank standing adjacent", () => {
    const state = board([
      ["D5", "white", "knight"], // rank 3
      ["D6", "black", "champion"], // rank 2
      ["C5", "black", "knight"], // equal rank, but belongs to the defender's side
    ]);
    const outcome = resolveCombat(state, D5, D6);
    expect(outcome.result).toBe("attackerLoses");
  });
});

import { describe, expect, it } from "vitest";
import type { Square } from "./board.ts";
import { resolveCombat, type CombatResult } from "./combat.ts";
import { renderMoveToken } from "./notation.ts";
import {
  EMPTY_POSITION,
  placePiece,
  type FlagPiece,
  type NumberedPiece,
} from "./position.ts";
import type { Rank } from "./pieces.ts";

const A2: Square = { column: "A", row: 2 };
const A4: Square = { column: "A", row: 4 };
const B1: Square = { column: "B", row: 1 };
const B3: Square = { column: "B", row: 3 };

function whitePiece(rank: Rank): NumberedPiece {
  return { side: "white", kind: "numbered", rank };
}

function blackPiece(rank: Rank): NumberedPiece {
  return { side: "black", kind: "numbered", rank };
}

const blackFlag: FlagPiece = { side: "black", kind: "flag" };

describe("notation (ruleset major 3): rules.md §4.5", () => {
  it("renders a plain move with no marks: A2-A4", () => {
    expect(renderMoveToken(A2, A4, null)).toBe("A2-A4");
  });

  it("renders an attacker win: A2=3-A4x (rules.md §4.5's own example)", () => {
    let position = placePiece(EMPTY_POSITION, A2, whitePiece(4));
    position = placePiece(position, A4, blackPiece(3));
    const combat = resolveCombat(position, A2, A4);
    expect(renderMoveToken(A2, A4, combat)).toBe("A2=3-A4x");
  });

  it("renders an attacker loss: A2x-A4=2 (rules.md §4.5's own example)", () => {
    let position = placePiece(EMPTY_POSITION, A2, whitePiece(1));
    position = placePiece(position, A4, blackPiece(3));
    const combat = resolveCombat(position, A2, A4);
    expect(renderMoveToken(A2, A4, combat)).toBe("A2x-A4=2");
  });

  it("renders a mutual loss: A2x-A4x", () => {
    let position = placePiece(EMPTY_POSITION, A2, whitePiece(3));
    position = placePiece(position, A4, blackPiece(3));
    const combat = resolveCombat(position, A2, A4);
    expect(renderMoveToken(A2, A4, combat)).toBe("A2x-A4x");
  });

  it("renders a Flag capture: A2-A4x (the only shape marking one square and not the other)", () => {
    let position = placePiece(EMPTY_POSITION, A2, whitePiece(1));
    position = placePiece(position, A4, blackFlag);
    const combat = resolveCombat(position, A2, A4);
    expect(combat.kind).toBe("flagCapture");
    expect(renderMoveToken(A2, A4, combat)).toBe("A2-A4x");
  });

  describe("property: every combat resolution marks exactly one mark per square, and no combat marks none", () => {
    const ranks: Rank[] = [1, 2, 3, 4, 5];

    function positionWithOptionalFriends(
      attackerRank: Rank,
      defenderRank: Rank,
      attackerHasFriend: boolean,
      defenderHasFriend: boolean,
    ) {
      let position = placePiece(EMPTY_POSITION, A2, whitePiece(attackerRank));
      position = placePiece(position, A4, blackPiece(defenderRank));
      if (attackerHasFriend) {
        position = placePiece(position, B1, whitePiece(attackerRank));
      }
      if (defenderHasFriend) {
        position = placePiece(position, B3, blackPiece(defenderRank));
      }
      return position;
    }

    /**
     * Splits `token` (the extended-notation string for a move from A2 to A4)
     * back into each square's own mark, for the assertions below. Not a
     * general-purpose parser - major 3 has none (see notation.ts's module
     * comment) - just enough to inspect what this property test produced.
     */
    function marksOf(token: string): {
      readonly from: string;
      readonly to: string;
    } {
      const [fromPart, toPart] = token.split("-");
      return {
        from: fromPart.slice("A2".length),
        to: toPart.slice("A4".length),
      };
    }

    it("marks exactly one of x/=N per square, for every rank pairing and formation-bonus combination", () => {
      let sampledCombats = 0;
      for (const attackerRank of ranks) {
        for (const defenderRank of ranks) {
          for (const attackerHasFriend of [false, true]) {
            for (const defenderHasFriend of [false, true]) {
              const position = positionWithOptionalFriends(
                attackerRank,
                defenderRank,
                attackerHasFriend,
                defenderHasFriend,
              );
              const combat: CombatResult = resolveCombat(position, A2, A4);
              expect(combat.kind).toBe("combat");
              sampledCombats += 1;

              const token = renderMoveToken(A2, A4, combat);
              const { from, to } = marksOf(token);

              // Exactly one mark each: never empty, never both an "x" and a
              // "=N" on the same square (structurally impossible here, but
              // asserted anyway), and always one of the two forms.
              expect(from.length).toBeGreaterThan(0);
              expect(to.length).toBeGreaterThan(0);
              expect(from === "x" || /^=[1-5]$/.test(from)).toBe(true);
              expect(to === "x" || /^=[1-5]$/.test(to)).toBe(true);
            }
          }
        }
      }
      // Sanity: the sweep actually exercised every combination (5*5*2*2).
      expect(sampledCombats).toBe(100);
    });

    it("marks a Flag capture as one square marked and the other not, for either side's Flag", () => {
      for (const attackerRank of ranks) {
        let position = placePiece(EMPTY_POSITION, A2, whitePiece(attackerRank));
        position = placePiece(position, A4, blackFlag);
        const combat = resolveCombat(position, A2, A4);
        expect(combat.kind).toBe("flagCapture");
        const { from, to } = marksOf(renderMoveToken(A2, A4, combat));
        expect(from).toBe("");
        expect(to).toBe("x");
      }
    });

    it("marks a plain (no-combat) move with no marks on either square", () => {
      const { from, to } = marksOf(renderMoveToken(A2, A4, null));
      expect(from).toBe("");
      expect(to).toBe("");
    });
  });

  it("never produces the simplified form (A2A4) for any move, combat or not", () => {
    let position = placePiece(EMPTY_POSITION, A2, whitePiece(3));
    position = placePiece(position, A4, blackPiece(3));
    const combat = resolveCombat(position, A2, A4);

    const tokens = [
      renderMoveToken(A2, A4, null),
      renderMoveToken(A2, A4, combat),
    ];
    for (const token of tokens) {
      expect(token).toContain("-");
      expect(token).not.toMatch(/^[A-H][1-8][A-H][1-8]$/);
    }
  });
});

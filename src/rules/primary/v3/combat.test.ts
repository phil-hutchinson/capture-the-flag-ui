import { describe, expect, it } from "vitest";
import type { Square } from "./board.ts";
import { resolveCombat, type CombatResult } from "./combat.ts";
import {
  demotePiece,
  EMPTY_POSITION,
  pieceAt,
  placePiece,
  type FlagPiece,
  type NumberedPiece,
  type PositionState,
} from "./position.ts";
import type { Rank } from "./pieces.ts";

const A1: Square = { column: "A", row: 1 };
const A2: Square = { column: "A", row: 2 };
const B1: Square = { column: "B", row: 1 };
const B2: Square = { column: "B", row: 2 };
const C1: Square = { column: "C", row: 1 };

function whitePiece(rank: Rank): NumberedPiece {
  return { side: "white", kind: "numbered", rank };
}

function blackPiece(rank: Rank): NumberedPiece {
  return { side: "black", kind: "numbered", rank };
}

const whiteFlag: FlagPiece = { side: "white", kind: "flag" };
const blackFlag: FlagPiece = { side: "black", kind: "flag" };

describe("combat (ruleset major 3): rank, formation bonus, rank reduction, Flag capture", () => {
  it("a stronger attacker wins: defender removed, attacker advances demoted one rank", () => {
    let position = placePiece(EMPTY_POSITION, A1, whitePiece(5));
    position = placePiece(position, A2, blackPiece(3));

    const result = resolveCombat(position, A1, A2);
    expect(result.kind).toBe("combat");
    if (result.kind !== "combat") throw new Error("unreachable");
    expect(result.outcome).toBe("attackerWins");
    expect(result.attacker).toEqual(whitePiece(5));
    expect(result.defender).toEqual(blackPiece(3));
    expect(result.survivorRank).toBe(4);
    expect(pieceAt(result.position, A1)).toBeUndefined();
    expect(pieceAt(result.position, A2)).toEqual(whitePiece(4));
  });

  it("a weaker attacker loses: attacker removed, defender stays and is demoted one rank", () => {
    let position = placePiece(EMPTY_POSITION, A1, whitePiece(2));
    position = placePiece(position, A2, blackPiece(5));

    const result = resolveCombat(position, A1, A2);
    expect(result.kind).toBe("combat");
    if (result.kind !== "combat") throw new Error("unreachable");
    expect(result.outcome).toBe("attackerLoses");
    expect(result.survivorRank).toBe(4);
    expect(pieceAt(result.position, A1)).toBeUndefined();
    expect(pieceAt(result.position, A2)).toEqual(blackPiece(4));
  });

  it("equal ranks trade: both pieces removed, neither reduced", () => {
    let position = placePiece(EMPTY_POSITION, A1, whitePiece(3));
    position = placePiece(position, A2, blackPiece(3));

    const result = resolveCombat(position, A1, A2);
    expect(result.kind).toBe("combat");
    if (result.kind !== "combat") throw new Error("unreachable");
    expect(result.outcome).toBe("draw");
    expect(result.survivorRank).toBeNull();
    expect(pieceAt(result.position, A1)).toBeUndefined();
    expect(pieceAt(result.position, A2)).toBeUndefined();
  });

  describe("the formation bonus - attacker", () => {
    function attackWithFriend(friendSquare: Square | null, friendRank: Rank) {
      let position = placePiece(EMPTY_POSITION, A1, whitePiece(3));
      position = placePiece(position, A2, blackPiece(4));
      if (friendSquare !== null) {
        position = placePiece(position, friendSquare, whitePiece(friendRank));
      }
      return resolveCombat(position, A1, A2);
    }

    it("draws instead of losing with an orthogonally adjacent friend of equal rank", () => {
      const result = attackWithFriend(B1, 3);
      expect(result.kind).toBe("combat");
      if (result.kind !== "combat") throw new Error("unreachable");
      expect(result.outcome).toBe("draw");
    });

    it("draws instead of losing with a diagonally adjacent friend of equal rank", () => {
      const result = attackWithFriend(B2, 3);
      expect(result.kind).toBe("combat");
      if (result.kind !== "combat") throw new Error("unreachable");
      expect(result.outcome).toBe("draw");
    });

    it("loses as normal with the friend two squares away", () => {
      const result = attackWithFriend(C1, 3);
      expect(result.kind).toBe("combat");
      if (result.kind !== "combat") throw new Error("unreachable");
      expect(result.outcome).toBe("attackerLoses");
    });

    it("loses as normal with an adjacent friend of a different rank", () => {
      const result = attackWithFriend(B1, 2);
      expect(result.kind).toBe("combat");
      if (result.kind !== "combat") throw new Error("unreachable");
      expect(result.outcome).toBe("attackerLoses");
    });

    it("loses as normal with no friend at all", () => {
      const result = attackWithFriend(null, 3);
      expect(result.kind).toBe("combat");
      if (result.kind !== "combat") throw new Error("unreachable");
      expect(result.outcome).toBe("attackerLoses");
    });

    it("never lets a piece beat a piece two ranks stronger", () => {
      let position = placePiece(EMPTY_POSITION, A1, whitePiece(3));
      position = placePiece(position, B1, whitePiece(3));
      position = placePiece(position, A2, blackPiece(5));

      const result = resolveCombat(position, A1, A2);
      expect(result.kind).toBe("combat");
      if (result.kind !== "combat") throw new Error("unreachable");
      expect(result.outcome).toBe("attackerLoses");
    });
  });

  describe("the formation bonus - defender, checked at the moment it is attacked", () => {
    function defendWithFriend(friendSquare: Square | null, friendRank: Rank) {
      let position = placePiece(EMPTY_POSITION, A1, whitePiece(4));
      position = placePiece(position, A2, blackPiece(3));
      if (friendSquare !== null) {
        position = placePiece(position, friendSquare, blackPiece(friendRank));
      }
      return resolveCombat(position, A1, A2);
    }

    it("draws instead of falling with an orthogonally adjacent friend of equal rank", () => {
      const result = defendWithFriend(B1, 3);
      expect(result.kind).toBe("combat");
      if (result.kind !== "combat") throw new Error("unreachable");
      expect(result.outcome).toBe("draw");
    });

    it("draws instead of falling with a diagonally adjacent friend of equal rank", () => {
      const result = defendWithFriend(B2, 3);
      expect(result.kind).toBe("combat");
      if (result.kind !== "combat") throw new Error("unreachable");
      expect(result.outcome).toBe("draw");
    });

    it("falls as normal with the friend two squares away", () => {
      const result = defendWithFriend(C1, 3);
      expect(result.kind).toBe("combat");
      if (result.kind !== "combat") throw new Error("unreachable");
      expect(result.outcome).toBe("attackerWins");
    });

    it("falls as normal with an adjacent friend of a different rank", () => {
      const result = defendWithFriend(B1, 2);
      expect(result.kind).toBe("combat");
      if (result.kind !== "combat") throw new Error("unreachable");
      expect(result.outcome).toBe("attackerWins");
    });
  });

  describe("the formation bonus is recomputed after an earlier demotion", () => {
    it("is lost once a demotion breaks the match", () => {
      let position = placePiece(EMPTY_POSITION, A1, whitePiece(3));
      position = placePiece(position, B1, whitePiece(3));
      position = placePiece(position, A2, blackPiece(4));

      // With the friend still matching, the bonus applies.
      expect(resolveCombat(position, A1, A2).kind).toBe("combat");
      const withBonus = resolveCombat(position, A1, A2);
      if (withBonus.kind !== "combat") throw new Error("unreachable");
      expect(withBonus.outcome).toBe("draw");

      // Demote the formation partner out of matching rank (3 -> 2); the
      // bonus must be recomputed fresh, not cached from before.
      const demoted = demotePiece(position, B1);
      const withoutBonus = resolveCombat(demoted, A1, A2);
      expect(withoutBonus.kind).toBe("combat");
      if (withoutBonus.kind !== "combat") throw new Error("unreachable");
      expect(withoutBonus.outcome).toBe("attackerLoses");
    });

    it("is gained once a demotion creates a match", () => {
      let position = placePiece(EMPTY_POSITION, A1, whitePiece(3));
      position = placePiece(position, B1, whitePiece(4));
      position = placePiece(position, A2, blackPiece(4));

      // The friend does not match yet (rank 4, attacker is rank 3): no bonus.
      const withoutBonus = resolveCombat(position, A1, A2);
      expect(withoutBonus.kind).toBe("combat");
      if (withoutBonus.kind !== "combat") throw new Error("unreachable");
      expect(withoutBonus.outcome).toBe("attackerLoses");

      // Demote the friend into a match (4 -> 3); the bonus must now apply.
      const demoted = demotePiece(position, B1);
      const withBonus = resolveCombat(demoted, A1, A2);
      expect(withBonus.kind).toBe("combat");
      if (withBonus.kind !== "combat") throw new Error("unreachable");
      expect(withBonus.outcome).toBe("draw");
    });
  });

  describe("Flag capture", () => {
    it("is not combat: the capturing piece is not reduced", () => {
      let position = placePiece(EMPTY_POSITION, A1, whitePiece(2));
      position = placePiece(position, A2, blackFlag);

      const result: CombatResult = resolveCombat(position, A1, A2);
      expect(result.kind).toBe("flagCapture");
      if (result.kind !== "flagCapture") throw new Error("unreachable");
      expect(result.attacker).toEqual(whitePiece(2));
      expect(result.defender).toEqual(blackFlag);
      expect(pieceAt(result.position, A1)).toBeUndefined();
      // The capturing piece stands on the Flag's square, at its ORIGINAL rank.
      expect(pieceAt(result.position, A2)).toEqual(whitePiece(2));
    });

    it("captures a Flag of either side, regardless of the capturing piece's rank", () => {
      let position = placePiece(EMPTY_POSITION, A1, blackPiece(5));
      position = placePiece(position, A2, whiteFlag);

      const result = resolveCombat(position, A1, A2);
      expect(result.kind).toBe("flagCapture");
      if (result.kind !== "flagCapture") throw new Error("unreachable");
      expect(pieceAt(result.position, A2)).toEqual(blackPiece(5));
    });
  });

  describe("rank reduction never yields a rank below 1", () => {
    // rules.md §4.3 argues a rank 1 can never survive combat: it draws
    // against another rank 1 (equal rank always draws, regardless of the
    // formation bonus - see below) and loses to everything stronger, and the
    // formation bonus never turns a *loss* into a *win*, only into a draw. So
    // a rank 1 attacker can never produce "attackerWins", and a rank 1
    // defender can never produce "attackerLoses" - across every rank pairing
    // and every formation-bonus combination. This sweep confirms the
    // implementation upholds that argument rather than merely trusting it;
    // `position.test.ts` separately confirms `reduceRank(1)` itself clamps,
    // for the (unreachable, but still guarded) case where it does not.
    const ranks: Rank[] = [1, 2, 3, 4, 5];

    function positionWithOptionalFriend(
      attackerRank: Rank,
      defenderRank: Rank,
      attackerHasFriend: boolean,
      defenderHasFriend: boolean,
    ): PositionState {
      let position = placePiece(EMPTY_POSITION, A1, whitePiece(attackerRank));
      position = placePiece(position, A2, blackPiece(defenderRank));
      if (attackerHasFriend) {
        position = placePiece(position, B1, whitePiece(attackerRank));
      }
      if (defenderHasFriend) {
        position = placePiece(position, B2, blackPiece(defenderRank));
      }
      return position;
    }

    it("a rank 1 attacker never wins, for every defender rank and formation-bonus combination", () => {
      for (const defenderRank of ranks) {
        for (const attackerHasFriend of [false, true]) {
          for (const defenderHasFriend of [false, true]) {
            const position = positionWithOptionalFriend(
              1,
              defenderRank,
              attackerHasFriend,
              defenderHasFriend,
            );
            const result = resolveCombat(position, A1, A2);
            expect(result.kind).toBe("combat");
            if (result.kind !== "combat") throw new Error("unreachable");
            expect(result.outcome).not.toBe("attackerWins");
            if (result.survivorRank !== null) {
              expect(result.survivorRank).toBeGreaterThanOrEqual(1);
            }
          }
        }
      }
    });

    it("a rank 1 defender never survives, for every attacker rank and formation-bonus combination", () => {
      for (const attackerRank of ranks) {
        for (const attackerHasFriend of [false, true]) {
          for (const defenderHasFriend of [false, true]) {
            const position = positionWithOptionalFriend(
              attackerRank,
              1,
              attackerHasFriend,
              defenderHasFriend,
            );
            const result = resolveCombat(position, A1, A2);
            expect(result.kind).toBe("combat");
            if (result.kind !== "combat") throw new Error("unreachable");
            expect(result.outcome).not.toBe("attackerLoses");
            if (result.survivorRank !== null) {
              expect(result.survivorRank).toBeGreaterThanOrEqual(1);
            }
          }
        }
      }
    });
  });

  it("throws attacking with the Flag, attacking an empty square, or attacking a friendly piece", () => {
    let position = placePiece(EMPTY_POSITION, A1, whiteFlag);
    position = placePiece(position, A2, blackPiece(3));
    expect(() => resolveCombat(position, A1, A2)).toThrow();

    const empty = placePiece(EMPTY_POSITION, A1, whitePiece(3));
    expect(() => resolveCombat(empty, A1, A2)).toThrow();

    let friendly = placePiece(EMPTY_POSITION, A1, whitePiece(3));
    friendly = placePiece(friendly, A2, whitePiece(4));
    expect(() => resolveCombat(friendly, A1, A2)).toThrow();
  });
});

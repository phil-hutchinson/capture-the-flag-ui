import { describe, expect, it } from "vitest";
import type { Square } from "../rules/primary/v1_1/board.ts";
import { RULESET_TAG } from "../rules/primary/v1_1/gameState.ts";
import type {
  BoardState,
  InitialGameState,
  PlacedPiece,
} from "../rules/primary/v1_1/gameState.ts";
import type { PieceTypeId } from "../rules/primary/v1_1/pieces.ts";
import {
  actionableSquares,
  activatableSquares,
  activateSquare,
  attackTargets,
  startSession,
  type PlaySession,
} from "./playSession.ts";

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

function initialGameState(
  pieces: readonly [string, PlacedPiece["side"], PieceTypeId][],
): InitialGameState {
  return { ruleset: RULESET_TAG, board: board(pieces) };
}

/** Sorts squares for order-independent comparison. */
function sortedKeys(squares: readonly Square[]): string[] {
  return squares.map((s) => `${s.column}${s.row}`).sort();
}

const sq = (column: Square["column"], row: Square["row"]): Square => ({
  column,
  row,
});

describe("startSession", () => {
  it("starts with White to move, nothing selected, and no resolved outcome", () => {
    const session = startSession(
      initialGameState([["D5", "white", "infantry"]]),
    );
    expect(session.play.sideToMove).toBe("white");
    expect(session.selection).toBeNull();
    expect(session.lastOutcome).toBeNull();
  });
});

describe("actionableSquares - nothing selected", () => {
  it("offers exactly the side-to-move's own movable pieces", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["E5", "white", "tower"], // own, but immobile - excluded
        ["D9", "black", "militia"], // opponent - excluded
      ]),
    );
    expect(sortedKeys(actionableSquares(session))).toEqual(["D5"]);
  });

  it("yields an empty actionable set (without throwing) when the side to move has neither a legal move nor a legal attack", () => {
    // White's infantry is boxed in on every side by *friendly* Towers, so it
    // has zero legal destinations (all four neighbours occupied) and zero
    // legal attacks (attacks only ever target an enemy - a friendly-occupied
    // square is never a target). The Towers are themselves immobile. White
    // has no other piece on the board, so no piece anywhere has a legal move
    // or attack. (Note: an enemy-surrounded piece, as story 00000004 used to
    // stage this case, is no longer "stuck" now that attacks are offered -
    // it would have a legal attack against each adjacent enemy.)
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["C5", "white", "tower"],
        ["E5", "white", "tower"],
        ["D4", "white", "tower"],
        ["D6", "white", "tower"],
      ]),
    );
    expect(() => actionableSquares(session)).not.toThrow();
    expect(actionableSquares(session)).toEqual([]);
  });
});

describe("activatableSquares - nothing selected", () => {
  it("matches actionableSquares: exactly the side-to-move's own movable pieces", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["E5", "white", "tower"], // own, but immobile - excluded
        ["D9", "black", "militia"], // opponent - excluded
      ]),
    );
    expect(sortedKeys(activatableSquares(session))).toEqual(["D5"]);
  });

  it("excludes an immobile own piece (Tower/Flag) even though it belongs to the side to move", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["E5", "white", "tower"],
        ["F5", "white", "flag"],
      ]),
    );
    expect(sortedKeys(activatableSquares(session))).toEqual(["D5"]);
  });

  it("excludes an opponent's piece", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["D9", "black", "militia"],
      ]),
    );
    expect(activatableSquares(session)).not.toContainEqual(sq("D", 9));
  });

  it("excludes an empty non-destination square", () => {
    const session = startSession(
      initialGameState([["D5", "white", "infantry"]]),
    );
    expect(activatableSquares(session)).not.toContainEqual(sq("H", 8));
  });
});

describe("activatableSquares - a piece selected", () => {
  it("is the side's own movable pieces (including the selected one) union the selected piece's legal destinations", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["H5", "white", "infantry"],
        ["D9", "black", "militia"],
        ["E5", "white", "tower"], // own, immobile - excluded
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));

    // Own movable pieces: D5 (the selected piece itself - this is what makes
    // reactivating it to deselect reachable) and H5. Plus D5's own legal
    // destinations (C5, D4, D6 - E5 is occupied by the Tower).
    expect(sortedKeys(activatableSquares(selected))).toEqual(
      ["D5", "H5", "C5", "D4", "D6"].sort(),
    );
  });

  it("still excludes an immobile own piece and an opponent's piece", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["H5", "white", "tower"],
        ["D9", "black", "militia"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    const keys = activatableSquares(selected);

    expect(keys).not.toContainEqual(sq("H", 5));
    expect(keys).not.toContainEqual(sq("D", 9));
  });
});

describe("activateSquare - selecting a piece", () => {
  it("selecting an own movable piece exposes exactly its legal destinations", () => {
    const session = startSession(
      initialGameState([["D5", "white", "infantry"]]),
    );
    const next = activateSquare(session, sq("D", 5));
    expect(next.selection).toEqual(sq("D", 5));
    expect(sortedKeys(actionableSquares(next))).toEqual(
      ["C5", "D4", "D6", "E5"].sort(),
    );
  });

  it("selecting an opponent's piece exposes nothing and does not select", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["D9", "black", "militia"],
      ]),
    );
    const next = activateSquare(session, sq("D", 9));
    expect(next.selection).toBeNull();
    expect(next).toEqual(session);
    expect(actionableSquares(next)).toEqual([sq("D", 5)]);
  });

  it("selecting an immobile own piece (Tower) exposes nothing and does not select", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["E5", "white", "tower"],
      ]),
    );
    const next = activateSquare(session, sq("E", 5));
    expect(next.selection).toBeNull();
    expect(next).toEqual(session);
  });

  it("activating the same selected piece again deselects it", () => {
    const session = startSession(
      initialGameState([["D5", "white", "infantry"]]),
    );
    const selected = activateSquare(session, sq("D", 5));
    expect(selected.selection).toEqual(sq("D", 5));

    const deselected = activateSquare(selected, sq("D", 5));
    expect(deselected.selection).toBeNull();
    expect(deselected.play).toBe(selected.play);
  });
});

describe("activateSquare - moving", () => {
  it("activating a legal destination applies the move, flips the side, and clears the selection", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["D9", "black", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    const moved = activateSquare(selected, sq("D", 4));

    expect(moved.selection).toBeNull();
    expect(moved.play.sideToMove).toBe("black");
    expect(moved.play.board["D5"]).toBeUndefined();
    expect(moved.play.board["D4"]).toEqual({
      side: "white",
      pieceType: "infantry",
    });
    expect(moved.play.moves).toEqual(["D5D4"]);
  });

  it("activating a non-destination while a piece is selected is a no-op", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["D9", "black", "militia"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    // D3 is two squares away - not a legal destination for a baseline piece.
    const next = activateSquare(selected, sq("D", 3));

    expect(next).toEqual(selected);
    expect(next.selection).toEqual(sq("D", 5));
  });

  it("activating an empty square with nothing selected is a no-op", () => {
    const session = startSession(
      initialGameState([["D5", "white", "infantry"]]),
    );
    const next = activateSquare(session, sq("H", 8));
    expect(next).toEqual(session);
  });
});

describe("activateSquare - switching selection", () => {
  it("activating a different own movable piece switches the selection to it", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["H5", "white", "infantry"],
      ]),
    );
    const selectedD5 = activateSquare(session, sq("D", 5));
    expect(selectedD5.selection).toEqual(sq("D", 5));

    const switchedToH5 = activateSquare(selectedD5, sq("H", 5));
    expect(switchedToH5.selection).toEqual(sq("H", 5));
    expect(switchedToH5.play).toBe(selectedD5.play);
    // Actionable squares now reflect H5's destinations, not D5's.
    expect(sortedKeys(actionableSquares(switchedToH5))).toEqual(
      ["G5", "H4", "H6", "I5"].sort(),
    );
  });

  it("activating an immobile own piece (Tower) while a piece is selected is still a no-op", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["H5", "white", "tower"],
      ]),
    );
    const selectedD5 = activateSquare(session, sq("D", 5));
    const next = activateSquare(selectedD5, sq("H", 5));

    expect(next).toEqual(selectedD5);
    expect(next.selection).toEqual(sq("D", 5));
  });
});

describe("activateSquare - turn alternation across a sequence", () => {
  it("strictly alternates sides across several moves", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
      ["D9", "black", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let session: PlaySession = startSession(initial);
    expect(session.play.sideToMove).toBe("white");

    session = activateSquare(session, sq("D", 5));
    session = activateSquare(session, sq("D", 4));
    expect(session.play.sideToMove).toBe("black");
    expect(session.selection).toBeNull();

    session = activateSquare(session, sq("D", 9));
    session = activateSquare(session, sq("D", 10));
    expect(session.play.sideToMove).toBe("white");
    expect(session.selection).toBeNull();

    session = activateSquare(session, sq("D", 4));
    session = activateSquare(session, sq("C", 4));
    expect(session.play.sideToMove).toBe("black");
    expect(session.play.moves).toEqual(["D5D4", "D9D10", "D4C4"]);
  });
});

describe("attacks - selectability", () => {
  it("a piece with no legal moves but a legal attack is still selectable", () => {
    // D5's infantry is boxed in on three sides by friendly Towers, so it has
    // zero legal *moves* - but E5 holds an enemy Militia, so it has one legal
    // attack. It must still appear as selectable.
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["C5", "white", "tower"],
        ["D4", "white", "tower"],
        ["D6", "white", "tower"],
        ["E5", "black", "militia"],
      ]),
    );
    expect(sortedKeys(actionableSquares(session))).toEqual(["D5"]);
    expect(sortedKeys(activatableSquares(session))).toEqual(["D5"]);
  });
});

describe("attacks - offered alongside moves, distinguishable", () => {
  it("exposes attack targets in the actionable/activatable sets and the attackTargets accessor, distinct from move targets", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["D9", "black", "militia"], // out of range - neither a move nor an attack target
        ["E5", "black", "champion"], // adjacent enemy - an attack target, not a move
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));

    // Plain move destinations: C5, D4, D6 (all empty and adjacent). E5 is
    // enemy-occupied, so it is an attack target, never a move destination.
    expect(sortedKeys(actionableSquares(selected))).toEqual(
      ["C5", "D4", "D6", "E5"].sort(),
    );
    expect(sortedKeys(activatableSquares(selected))).toEqual(
      ["D5", "C5", "D4", "D6", "E5"].sort(),
    );
    expect(sortedKeys(attackTargets(selected))).toEqual(["E5"]);
  });

  it("attackTargets is empty when nothing is selected", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["E5", "black", "militia"],
      ]),
    );
    expect(attackTargets(session)).toEqual([]);
  });

  it("a friendly-occupied square is never offered as a move or attack target", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["E5", "white", "tower"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    expect(actionableSquares(selected)).not.toContainEqual(sq("E", 5));
    expect(attackTargets(selected)).toEqual([]);
  });

  it("an enemy Flag square is offered as an attack target (story 00000006 - the Flag is now capturable)", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["E5", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    expect(actionableSquares(selected)).toContainEqual(sq("E", 5));
    expect(attackTargets(selected)).toEqual([sq("E", 5)]);
    // The piece's other, empty-square destinations remain available too.
    expect(sortedKeys(actionableSquares(selected))).toEqual(
      ["C5", "D4", "D6", "E5"].sort(),
    );
  });
});

describe("attacks - activating a target", () => {
  it("applies the attack, flips the side, clears the selection, and records the resolved outcome", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"], // rank 4
        ["E5", "black", "militia"], // rank 6 - weaker, so the attacker wins
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    const attacked = activateSquare(selected, sq("E", 5));

    expect(attacked.selection).toBeNull();
    expect(attacked.play.sideToMove).toBe("black");
    expect(attacked.play.board["D5"]).toBeUndefined();
    expect(attacked.play.board["E5"]).toEqual({
      side: "white",
      pieceType: "infantry",
    });
    expect(attacked.play.moves).toEqual(["D5E5"]);
    expect(attacked.lastOutcome).toEqual({
      kind: "attack",
      result: "attackerWins",
      attacker: { side: "white", pieceType: "infantry" },
      defender: { side: "black", pieceType: "militia" },
      square: sq("E", 5),
      capture: true,
      archerSupport: false,
    });
  });

  it("records a mutual-loss outcome (both pieces removed) for an equal-rank attack", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"], // rank 4
        ["E5", "black", "infantry"], // rank 4 - equal, mutual loss
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    const attacked = activateSquare(selected, sq("E", 5));

    expect(attacked.play.board["D5"]).toBeUndefined();
    expect(attacked.play.board["E5"]).toBeUndefined();
    expect(attacked.lastOutcome).toMatchObject({
      kind: "attack",
      result: "mutualLoss",
      capture: true,
    });
  });

  it("a plain move (not an attack) records a non-combat outcome", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    const moved = activateSquare(selected, sq("D", 4));

    expect(moved.lastOutcome).toEqual({
      kind: "move",
      piece: { side: "white", pieceType: "infantry" },
      square: sq("D", 4),
    });
  });
});

describe("attacks - turn alternation with attacks mixed in", () => {
  it("strictly alternates sides across a sequence mixing a plain move and an attack", () => {
    const initial = initialGameState([
      ["D5", "white", "infantry"],
      ["D7", "black", "militia"],
      ["A1", "white", "flag"],
      ["L12", "black", "flag"],
    ]);
    let session: PlaySession = startSession(initial);
    expect(session.play.sideToMove).toBe("white");

    // White makes a plain move, bringing its piece adjacent to Black's.
    session = activateSquare(session, sq("D", 5));
    session = activateSquare(session, sq("D", 6));
    expect(session.play.sideToMove).toBe("black");
    expect(session.selection).toBeNull();
    expect(session.lastOutcome).toEqual({
      kind: "move",
      piece: { side: "white", pieceType: "infantry" },
      square: sq("D", 6),
    });

    // Black attacks White's now-adjacent piece. Militia (rank 6) attacking
    // Infantry (rank 4): the defender is stronger, so the attacker loses.
    session = activateSquare(session, sq("D", 7));
    expect(sortedKeys(attackTargets(session))).toEqual(["D6"]);
    session = activateSquare(session, sq("D", 6));

    expect(session.play.sideToMove).toBe("white");
    expect(session.selection).toBeNull();
    expect(session.play.moves).toEqual(["D5D6", "D7D6"]);
    expect(session.play.board["D7"]).toBeUndefined();
    expect(session.play.board["D6"]).toEqual({
      side: "white",
      pieceType: "infantry",
    });
    expect(session.lastOutcome).toMatchObject({
      kind: "attack",
      result: "attackerLoses",
    });
  });
});

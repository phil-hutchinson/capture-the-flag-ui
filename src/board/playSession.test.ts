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
  acceptDraw,
  actionableSquares,
  activatableSquares,
  activateSquare,
  attackTargets,
  declineDraw,
  offerDraw,
  startSession,
  viewSide,
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
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
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
    // it would have a legal attack against each adjacent enemy.) Both sides
    // have a Flag, elsewhere on the board, so this scenario is exactly what
    // it looks like: White having no legal ply at all is itself a real §6.3
    // game-ending condition (story 00000006), detected at the reveal - so
    // `actionableSquares` is empty both because White is boxed in and
    // because the board is now inert. Either way, the assertion - empty,
    // never throws - holds.
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["C5", "white", "tower"],
        ["E5", "white", "tower"],
        ["D4", "white", "tower"],
        ["D6", "white", "tower"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
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
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
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
        ["L12", "black", "flag"],
      ]),
    );
    expect(sortedKeys(activatableSquares(session))).toEqual(["D5"]);
  });

  it("excludes an opponent's piece", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["D9", "black", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    expect(activatableSquares(session)).not.toContainEqual(sq("D", 9));
  });

  it("excludes an empty non-destination square", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
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
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
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
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
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
      initialGameState([
        ["D5", "white", "infantry"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
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
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
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
      initialGameState([
        ["D5", "white", "infantry"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
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
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
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
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
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
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
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
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
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
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
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
        ["A1", "white", "flag"],
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

describe("game over: the board is inert (story 00000006, Step 6)", () => {
  /**
   * A session whose game has already ended: White's Infantry captures
   * Black's Flag (offered as an attack target since story 00000006's Step
   * 2), which is an immediate `flagCapture` win for White (Step 4). Also
   * carries a spare piece for each side (Black's Militia at H8, White's
   * Militia at K3) and an empty square (F6) so the no-op assertions below can
   * exercise an "own piece" (from the new side to move, Black), an
   * "opponent's piece", and an empty square all in one board.
   */
  function finishedSession(): PlaySession {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["D4", "black", "flag"],
        ["A1", "white", "flag"],
        ["H8", "black", "militia"],
        ["K3", "white", "militia"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    return activateSquare(selected, sq("D", 4));
  }

  it("ends the game as a flag-capture win for White, for this fixture", () => {
    const session = finishedSession();
    expect(session.play.result).toEqual({
      kind: "win",
      winner: "white",
      reason: "flagCapture",
    });
    expect(session.play.sideToMove).toBe("black");
  });

  it("actionableSquares and activatableSquares are both empty once the game has ended", () => {
    const session = finishedSession();
    expect(actionableSquares(session)).toEqual([]);
    expect(activatableSquares(session)).toEqual([]);
  });

  it("attackTargets is empty once the game has ended, even with a selection carried over (Minor 3 fix)", () => {
    // `finishedSession()` itself leaves `selection === null` (a completed ply
    // always clears it), which would make `attackTargets` empty anyway
    // without the `isInert` guard - so this asserts the guard directly by
    // reconstructing a finished session with a non-null `selection`, which
    // `attackTargets` must still treat as inert rather than by accident.
    const session = finishedSession();
    const withSelection: PlaySession = { ...session, selection: sq("H", 8) };
    expect(attackTargets(withSelection)).toEqual([]);
  });

  it("activateSquare is a no-op on an own piece, an enemy piece, and an empty square once the game has ended", () => {
    const session = finishedSession();
    // H8: Black's own Militia (Black is the side to move now, post-capture).
    expect(activateSquare(session, sq("H", 8))).toBe(session);
    // K3: White's (the opponent's) Militia.
    expect(activateSquare(session, sq("K", 3))).toBe(session);
    // F6: an empty square.
    expect(activateSquare(session, sq("F", 6))).toBe(session);
  });
});

describe("draw offer state machine (story 00000006, Step 6)", () => {
  /** An ordinary, ongoing mid-game session with White to move. */
  function ongoingSession(): PlaySession {
    return startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["D9", "black", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
  }

  it("a fresh session has no pending draw offer", () => {
    expect(ongoingSession().drawOffer).toBeNull();
  });

  it("offerDraw records the side to move as the offerer and makes the board inert", () => {
    const session = ongoingSession();
    const offered = offerDraw(session);

    expect(offered.drawOffer).toBe("white");
    expect(offered.play).toBe(session.play);
    expect(actionableSquares(offered)).toEqual([]);
    expect(activatableSquares(offered)).toEqual([]);
    expect(activateSquare(offered, sq("D", 5))).toBe(offered);
  });

  it("offerDraw clears any current selection", () => {
    const session = ongoingSession();
    const selected = activateSquare(session, sq("D", 5));
    expect(selected.selection).toEqual(sq("D", 5));

    const offered = offerDraw(selected);
    expect(offered.selection).toBeNull();
    expect(offered.drawOffer).toBe("white");
  });

  it("offerDraw is a no-op when the game has already ended", () => {
    const session = finishedSessionForDrawTests();
    expect(offerDraw(session)).toBe(session);
  });

  it("offerDraw is a no-op when an offer is already pending", () => {
    const session = ongoingSession();
    const offered = offerDraw(session);
    expect(offerDraw(offered)).toBe(offered);
  });

  it("declineDraw clears the offer, leaves sideToMove unchanged, adds no move, and restores the actionable/activatable sets", () => {
    const session = ongoingSession();
    const offered = offerDraw(session);

    const declined = declineDraw(offered);
    expect(declined.drawOffer).toBeNull();
    expect(declined.play.sideToMove).toBe("white");
    expect(declined.play.moves).toEqual([]);
    expect(declined.play.inactivityCounters).toEqual({ white: 0, black: 0 });
    expect(declined.play.progressCounter).toBe(0);
    expect(actionableSquares(declined)).toEqual(actionableSquares(session));
    expect(activatableSquares(declined)).toEqual(activatableSquares(session));
    // The offering player (White) can then move as usual.
    const selected = activateSquare(declined, sq("D", 5));
    expect(selected.selection).toEqual(sq("D", 5));
  });

  it("declineDraw is a no-op when no offer is pending", () => {
    const session = ongoingSession();
    expect(declineDraw(session)).toBe(session);
  });

  it("acceptDraw ends the game as an agreed draw and leaves the board inert", () => {
    const session = ongoingSession();
    const offered = offerDraw(session);

    const accepted = acceptDraw(offered);
    expect(accepted.drawOffer).toBeNull();
    expect(accepted.play.result).toEqual({ kind: "draw", reason: "agreement" });
    // Nothing else about the play state changed.
    expect(accepted.play.sideToMove).toBe("white");
    expect(accepted.play.moves).toEqual([]);
    expect(actionableSquares(accepted)).toEqual([]);
    expect(activatableSquares(accepted)).toEqual([]);
  });

  it("acceptDraw is a no-op when no offer is pending", () => {
    const session = ongoingSession();
    expect(acceptDraw(session)).toBe(session);
  });

  it("an ordinary mid-game session with no offer behaves exactly as before", () => {
    const session = ongoingSession();
    expect(session.drawOffer).toBeNull();
    const selected = activateSquare(session, sq("D", 5));
    const moved = activateSquare(selected, sq("D", 4));

    expect(moved.drawOffer).toBeNull();
    expect(moved.play.sideToMove).toBe("black");
    expect(moved.play.moves).toEqual(["D5D4"]);
  });
});

describe("viewSide - whose perspective the board is drawn from", () => {
  function ongoingSession(): PlaySession {
    return startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["D9", "black", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
  }

  it("follows the side to move with no offer pending", () => {
    const session = ongoingSession();
    expect(viewSide(session)).toBe("white");

    const selected = activateSquare(session, sq("D", 5));
    const moved = activateSquare(selected, sq("D", 4));
    expect(viewSide(moved)).toBe("black");
  });

  it("switches to the responder while an offer awaits an answer", () => {
    // The turn is still White's - an offer never replaces a move - but it is
    // Black who is sitting at the board, being asked to answer, so the board
    // is drawn from Black's perspective.
    const offered = offerDraw(ongoingSession());
    expect(offered.play.sideToMove).toBe("white");
    expect(viewSide(offered)).toBe("black");
  });

  it("switches back to the offerer when the offer is declined", () => {
    const declined = declineDraw(offerDraw(ongoingSession()));
    expect(declined.drawOffer).toBeNull();
    expect(viewSide(declined)).toBe("white");
  });

  it("switches back to the side to move when the offer is accepted", () => {
    // Accepting ends the game; the final position is shown to the side to
    // move (the offerer), exactly as it is for every other ending.
    const accepted = acceptDraw(offerDraw(ongoingSession()));
    expect(accepted.play.result.kind).toBe("draw");
    expect(viewSide(accepted)).toBe("white");
  });

  it("is unaffected by an offer from the other side", () => {
    // Black to move, Black offers: it is now White who must answer.
    const session = ongoingSession();
    const selected = activateSquare(session, sq("D", 5));
    const blackToMove = activateSquare(selected, sq("D", 4));
    expect(viewSide(blackToMove)).toBe("black");

    const offered = offerDraw(blackToMove);
    expect(viewSide(offered)).toBe("white");
    expect(viewSide(declineDraw(offered))).toBe("black");
  });

  it("with flipping off, always returns white regardless of who is to move", () => {
    const session = ongoingSession();
    expect(viewSide(session, false)).toBe("white");

    const selected = activateSquare(session, sq("D", 5));
    const blackToMove = activateSquare(selected, sq("D", 4));
    expect(blackToMove.play.sideToMove).toBe("black");
    expect(viewSide(blackToMove, false)).toBe("white");
  });

  it("with flipping off, stays on white even while a draw offer is pending, regardless of who offered", () => {
    const session = ongoingSession();
    const offeredByWhite = offerDraw(session);
    expect(viewSide(offeredByWhite, false)).toBe("white");

    const selected = activateSquare(session, sq("D", 5));
    const blackToMove = activateSquare(selected, sq("D", 4));
    const offeredByBlack = offerDraw(blackToMove);
    expect(viewSide(offeredByBlack, false)).toBe("white");
  });
});

/**
 * A session whose game has already ended (a flag-capture win for White), for
 * the draw-offer no-op tests above - separate from the "game over" describe
 * block's `finishedSession` so each block reads standalone.
 */
function finishedSessionForDrawTests(): PlaySession {
  const session = startSession(
    initialGameState([
      ["D5", "white", "infantry"],
      ["D4", "black", "flag"],
      ["A1", "white", "flag"],
    ]),
  );
  const selected = activateSquare(session, sq("D", 5));
  return activateSquare(selected, sq("D", 4));
}

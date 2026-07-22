import { describe, expect, it } from "vitest";
import type { Square } from "../rules/primary/v1/board.ts";
import { RULESET_TAG } from "../rules/primary/v1/gameState.ts";
import type {
  BoardState,
  InitialGameState,
  PlacedPiece,
} from "../rules/primary/v1/gameState.ts";
import type { GameOutcome } from "../rules/primary/v1/outcome.ts";
import type { PieceTypeId } from "../rules/primary/v1/pieces.ts";
import type { PlayState } from "../rules/primary/v1/play.ts";
import {
  describeActivation,
  describeDrawAccepted,
  describeDrawDecline,
  describeDrawOffer,
  describeResult,
} from "./playAnnouncement.ts";
import {
  activateSquare,
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

const sq = (column: Square["column"], row: Square["row"]): Square => ({
  column,
  row,
});

describe("describeActivation - selecting a piece", () => {
  it("announces the piece and its legal-destination count", () => {
    // Unencumbered (no enemy anywhere on the board), so the count includes
    // both the one- and two-square options in all four directions: 8.
    const session = startSession(
      initialGameState([
        ["D5", "white", "footSoldier"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));

    expect(describeActivation(session, selected, sq("D", 5))).toBe(
      "Red Foot Soldier selected, 8 moves available.",
    );
  });

  it("uses singular wording for exactly one available move", () => {
    // Boxed in by friendly pieces on three sides (never attack targets, and
    // never a source of encumbrance), one empty neighbor. A diagonal enemy
    // at C4 encumbers the piece (within its eight surrounding squares) but
    // is not itself an attack target (attacks are orthogonal only) - so this
    // is exactly one plain move (E5) and no attacks, with the two-square
    // option withheld everywhere by the encumbrance.
    const session = startSession(
      initialGameState([
        ["D5", "white", "footSoldier"],
        ["C5", "white", "militia"],
        ["D4", "white", "militia"],
        ["D6", "white", "militia"],
        ["C4", "black", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));

    expect(describeActivation(session, selected, sq("D", 5))).toBe(
      "Red Foot Soldier selected, 1 move available.",
    );
  });

  it("combines plain-move destinations and attack targets into a single count", () => {
    // Boxed in by enemies on three sides, one empty neighbor: 1 plain move
    // plus 3 attack targets = 4 moves available.
    const session = startSession(
      initialGameState([
        ["D5", "white", "footSoldier"],
        ["C5", "black", "militia"],
        ["D4", "black", "militia"],
        ["D6", "black", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));

    expect(describeActivation(session, selected, sq("D", 5))).toBe(
      "Red Foot Soldier selected, 4 moves available.",
    );
  });

  it("announces a non-zero count for a piece that can only attack", () => {
    // Surrounded on all four sides by enemies: no plain-move destinations,
    // but 4 legal attack targets, so the count must not read "0 moves".
    const session = startSession(
      initialGameState([
        ["D5", "white", "footSoldier"],
        ["C5", "black", "militia"],
        ["E5", "black", "militia"],
        ["D4", "black", "militia"],
        ["D6", "black", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));

    expect(describeActivation(session, selected, sq("D", 5))).toBe(
      "Red Foot Soldier selected, 4 moves available.",
    );
  });

  it("announces Blue's piece by color when Black is to move", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "footSoldier"],
        ["D9", "black", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const moved = activateSquare(session, sq("D", 5));
    const afterMove = activateSquare(moved, sq("D", 4));
    const selected = activateSquare(afterMove, sq("D", 9));

    // D9's only nearby piece (White's footSoldier) has moved away to D4, so D9
    // is unencumbered: 8 moves (one- and two-square, all four directions).
    expect(describeActivation(afterMove, selected, sq("D", 9))).toBe(
      "Blue Militia selected, 8 moves available.",
    );
  });
});

describe("describeActivation - switching selection", () => {
  it("announces the newly selected piece, not the previous one", () => {
    // Every mobile piece type moves identically in 1.2 - no extended range
    // for any type - so an unencumbered piece in open space, regardless of
    // type, has 8 moves (one- and two-square, all four directions).
    const session = startSession(
      initialGameState([
        ["D5", "white", "footSoldier"],
        ["H5", "white", "knight"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selectedD5 = activateSquare(session, sq("D", 5));
    const switchedToH5 = activateSquare(selectedD5, sq("H", 5));

    expect(describeActivation(selectedD5, switchedToH5, sq("H", 5))).toBe(
      "Red Knight selected, 8 moves available.",
    );
  });
});

describe("describeActivation - moving", () => {
  it("announces the mover, its destination, and whose turn it now is", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "footSoldier"],
        ["D9", "black", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    const moved = activateSquare(selected, sq("D", 4));

    expect(describeActivation(selected, moved, sq("D", 4))).toBe(
      "Red Foot Soldier moved to D4. Blue to move.",
    );
  });

  it("announces a Black move handing the turn back to Red", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "footSoldier"],
        ["D9", "black", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const afterWhite = activateSquare(
      activateSquare(session, sq("D", 5)),
      sq("D", 4),
    );
    const selected = activateSquare(afterWhite, sq("D", 9));
    const moved = activateSquare(selected, sq("D", 10));

    expect(describeActivation(selected, moved, sq("D", 10))).toBe(
      "Blue Militia moved to D10. Red to move.",
    );
  });
});

describe("describeActivation - combat outcomes", () => {
  it("announces an attacker-wins result: who fought, who fell, whose turn", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "footSoldier"],
        ["D4", "black", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
        // A second, otherwise-uninvolved Black piece so Black still has a
        // legal move after the Militia falls - without it, Black would be
        // left with nothing but an immobile Flag, which is itself a §6.3
        // no-legal-move loss and would end the game (see story 00000006).
        ["L11", "black", "militia"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    const resolved = activateSquare(selected, sq("D", 4));

    expect(describeActivation(selected, resolved, sq("D", 4))).toBe(
      "Red Foot Soldier attacked Blue Militia at D4: Blue Militia falls, Red Foot Soldier advances. Blue to move.",
    );
  });

  it("announces an attacker-loses result: who fought, who fell, whose turn", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "militia"],
        ["D4", "black", "footSoldier"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    const resolved = activateSquare(selected, sq("D", 4));

    expect(describeActivation(selected, resolved, sq("D", 4))).toBe(
      "Red Militia attacked Blue Foot Soldier at D4 and falls; Blue Foot Soldier holds. Blue to move.",
    );
  });

  it("announces a mutual-loss result: who fought, both fell, whose turn", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "footSoldier"],
        ["D4", "black", "footSoldier"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
        // A second, otherwise-uninvolved Black piece so Black still has a
        // legal move after both combatants fall - see the note in the
        // attacker-wins case above.
        ["L11", "black", "militia"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    const resolved = activateSquare(selected, sq("D", 4));

    expect(describeActivation(selected, resolved, sq("D", 4))).toBe(
      "Red Foot Soldier attacked Blue Foot Soldier at D4: both fall. Blue to move.",
    );
  });

  it("announces a Black attack handing the turn back to Red", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "footSoldier"],
        ["D9", "black", "militia"],
        ["D10", "white", "halberdier"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const afterWhite = activateSquare(
      activateSquare(session, sq("D", 5)),
      sq("D", 4),
    );
    const selected = activateSquare(afterWhite, sq("D", 9));
    const resolved = activateSquare(selected, sq("D", 10));

    expect(describeActivation(selected, resolved, sq("D", 10))).toBe(
      "Blue Militia attacked Red Halberdier at D10 and falls; Red Halberdier holds. Red to move.",
    );
  });
});

describe("describeActivation - deselecting", () => {
  it("announces the piece being deselected", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "footSoldier"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    const deselected = activateSquare(selected, sq("D", 5));

    expect(describeActivation(selected, deselected, sq("D", 5))).toBe(
      "Red Foot Soldier deselected.",
    );
  });
});

describe("describeActivation - no-op activation", () => {
  it("returns an empty string when nothing changed", () => {
    const session = startSession(
      initialGameState([["D5", "white", "footSoldier"]]),
    );
    // Not reachable through the UI (only actionable cells can be activated),
    // but the helper degrades gracefully rather than throwing or fabricating
    // a misleading announcement.
    expect(describeActivation(session, session, sq("H", 8))).toBe("");
  });
});

describe("describeActivation - game-ending ply", () => {
  it("announces a Flag capture: what the ply did, the winner, and the reason - and never says 'to move'", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "militia"],
        ["D6", "black", "flag"],
        ["A1", "white", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    const resolved = activateSquare(selected, sq("D", 6));

    const announcement = describeActivation(selected, resolved, sq("D", 6));
    expect(announcement).toBe(
      "Red Militia attacked Blue Flag at D6: Blue Flag falls, Red Militia advances. Red wins — Flag captured.",
    );
    expect(announcement).not.toContain("to move");
  });

  // The remaining endings are built directly as `PlayState`/`PlaySession`
  // pairs (per the step's verification), rather than played out through a
  // legal ply, since `describeActivation` only reads `before`/`after` data -
  // it does not itself validate legality or re-derive the result.
  function endingSession(
    initialResult: GameOutcome,
    piece: [string, PlacedPiece["side"], PieceTypeId],
    destination: Square,
    finalResult: GameOutcome,
  ): { before: PlaySession; after: PlaySession } {
    const [originKey, side, pieceType] = piece;
    const before: PlayState = {
      ruleset: RULESET_TAG,
      initialBoard: board([piece]),
      board: board([piece]),
      sideToMove: side,
      moves: [],
      inactivityCounter: 0,
      result: initialResult,
    };
    const destinationKey = `${destination.column}${destination.row}`;
    const after: PlayState = {
      ...before,
      board: board([[destinationKey, side, pieceType]]),
      sideToMove: side === "white" ? "black" : "white",
      moves: [`${originKey}${destinationKey}`],
      result: finalResult,
    };
    return {
      before: {
        play: before,
        selection: sq(
          originKey[0] as Square["column"],
          Number(originKey.slice(1)) as Square["row"],
        ),
        lastOutcome: null,
        drawOffer: null,
      },
      after: {
        play: after,
        selection: null,
        lastOutcome: {
          kind: "move",
          piece: { side, pieceType },
          square: destination,
        },
        drawOffer: null,
      },
    };
  }

  it("announces a No Legal Move win, replacing the 'to move' clause with the result", () => {
    const { before, after } = endingSession(
      { kind: "ongoing" },
      ["A1", "white", "footSoldier"],
      sq("A", 2),
      { kind: "win", winner: "white", reason: "noLegalMove" },
    );
    expect(describeActivation(before, after, sq("A", 2))).toBe(
      "Red Foot Soldier moved to A2. Red wins — Blue has no legal move left.",
    );
  });

  it("announces an Inactivity draw", () => {
    const { before, after } = endingSession(
      { kind: "ongoing" },
      ["L12", "black", "footSoldier"],
      sq("L", 11),
      { kind: "draw", reason: "inactivity" },
    );
    expect(describeActivation(before, after, sq("L", 11))).toBe(
      "Blue Foot Soldier moved to L11. The game is a draw — by inactivity.",
    );
  });
});

describe("describeResult", () => {
  it("renders a win for Red with each win reason, naming Blue as the losing side where the reason needs a subject", () => {
    expect(
      describeResult({ kind: "win", winner: "white", reason: "flagCapture" }),
    ).toBe("Red wins — Flag captured.");
    expect(
      describeResult({ kind: "win", winner: "white", reason: "noLegalMove" }),
    ).toBe("Red wins — Blue has no legal move left.");
  });

  it("renders a win for Blue, naming Red as the losing side", () => {
    expect(
      describeResult({ kind: "win", winner: "black", reason: "flagCapture" }),
    ).toBe("Blue wins — Flag captured.");
    expect(
      describeResult({ kind: "win", winner: "black", reason: "noLegalMove" }),
    ).toBe("Blue wins — Red has no legal move left.");
  });

  it("renders a draw with each remaining reason", () => {
    expect(describeResult({ kind: "draw", reason: "inactivity" })).toBe(
      "The game is a draw — by inactivity.",
    );
    expect(describeResult({ kind: "draw", reason: "agreement" })).toBe(
      "The game is a draw — Agreement.",
    );
  });

  it("returns an empty string for an ongoing game", () => {
    expect(describeResult({ kind: "ongoing" })).toBe("");
  });
});

describe("describeDrawOffer / describeDrawDecline / describeDrawAccepted", () => {
  it("names the offering side and asks the opponent to answer", () => {
    expect(describeDrawOffer("white")).toBe(
      "Red offers a draw. Blue, accept or decline?",
    );
    expect(describeDrawOffer("black")).toBe(
      "Blue offers a draw. Red, accept or decline?",
    );
  });

  it("names who declined and that the offering player still moves", () => {
    expect(describeDrawDecline("white")).toBe(
      "Blue declines the draw offer. Red to move.",
    );
    expect(describeDrawDecline("black")).toBe(
      "Red declines the draw offer. Blue to move.",
    );
  });

  it("reuses the result-and-reason sentence for an accepted draw", () => {
    expect(describeDrawAccepted({ kind: "draw", reason: "agreement" })).toBe(
      "The game is a draw — Agreement.",
    );
  });
});

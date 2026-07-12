import { describe, expect, it } from "vitest";
import type { Square } from "../rules/primary/v1_1/board.ts";
import { RULESET_TAG } from "../rules/primary/v1_1/gameState.ts";
import type {
  BoardState,
  InitialGameState,
  PlacedPiece,
} from "../rules/primary/v1_1/gameState.ts";
import type { GameOutcome } from "../rules/primary/v1_1/outcome.ts";
import type { PieceTypeId } from "../rules/primary/v1_1/pieces.ts";
import type { PlayState } from "../rules/primary/v1_1/play.ts";
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
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));

    expect(describeActivation(session, selected, sq("D", 5))).toBe(
      "Red Infantry selected, 4 moves available.",
    );
  });

  it("uses singular wording for exactly one available move", () => {
    // Boxed in by friendly pieces on three sides (never attack targets), one
    // empty neighbor: exactly one plain move and no attacks.
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["C5", "white", "militia"],
        ["D4", "white", "militia"],
        ["D6", "white", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));

    expect(describeActivation(session, selected, sq("D", 5))).toBe(
      "Red Infantry selected, 1 move available.",
    );
  });

  it("combines plain-move destinations and attack targets into a single count", () => {
    // Boxed in by enemies on three sides, one empty neighbor: 1 plain move
    // plus 3 attack targets = 4 moves available.
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["C5", "black", "militia"],
        ["D4", "black", "militia"],
        ["D6", "black", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));

    expect(describeActivation(session, selected, sq("D", 5))).toBe(
      "Red Infantry selected, 4 moves available.",
    );
  });

  it("announces a non-zero count for a piece that can only attack", () => {
    // Surrounded on all four sides by enemies: no plain-move destinations,
    // but 4 legal attack targets, so the count must not read "0 moves".
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
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
      "Red Infantry selected, 4 moves available.",
    );
  });

  it("announces Blue's piece by color when Black is to move", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["D9", "black", "militia"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const moved = activateSquare(session, sq("D", 5));
    const afterMove = activateSquare(moved, sq("D", 4));
    const selected = activateSquare(afterMove, sq("D", 9));

    expect(describeActivation(afterMove, selected, sq("D", 9))).toBe(
      "Blue Militia selected, 4 moves available.",
    );
  });
});

describe("describeActivation - switching selection", () => {
  it("announces the newly selected piece, not the previous one", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["H5", "white", "skirmisher"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selectedD5 = activateSquare(session, sq("D", 5));
    const switchedToH5 = activateSquare(selectedD5, sq("H", 5));

    expect(describeActivation(selectedD5, switchedToH5, sq("H", 5))).toBe(
      "Red Skirmisher selected, 12 moves available.",
    );
  });
});

describe("describeActivation - moving", () => {
  it("announces the mover, its destination, and whose turn it now is", () => {
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

    expect(describeActivation(selected, moved, sq("D", 4))).toBe(
      "Red Infantry moved to D4. Blue to move.",
    );
  });

  it("announces a Black move handing the turn back to Red", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
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
        ["D5", "white", "infantry"],
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
      "Red Infantry attacked Blue Militia at D4: Blue Militia falls, Red Infantry advances. Blue to move.",
    );
  });

  it("announces an attacker-loses result: who fought, who fell, whose turn", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "militia"],
        ["D4", "black", "infantry"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    const resolved = activateSquare(selected, sq("D", 4));

    expect(describeActivation(selected, resolved, sq("D", 4))).toBe(
      "Red Militia attacked Blue Infantry at D4 and falls; Blue Infantry holds. Blue to move.",
    );
  });

  it("announces a mutual-loss result: who fought, both fell, whose turn", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
        ["D4", "black", "infantry"],
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
      "Red Infantry attacked Blue Infantry at D4: both fall. Blue to move.",
    );
  });

  it("mentions Archer support when it flips the result to mutual loss", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "lordMarshal"],
        ["D4", "black", "halberdier"],
        ["D3", "black", "archer"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    const resolved = activateSquare(selected, sq("D", 4));

    expect(describeActivation(selected, resolved, sq("D", 4))).toBe(
      "Red Lord Marshal attacked Blue Halberdier at D4: both fall. Archer support turns the attack back. Blue to move.",
    );
  });

  it("announces a Black attack handing the turn back to Red", () => {
    const session = startSession(
      initialGameState([
        ["D5", "white", "infantry"],
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
        ["D5", "white", "infantry"],
        ["A1", "white", "flag"],
        ["L12", "black", "flag"],
      ]),
    );
    const selected = activateSquare(session, sq("D", 5));
    const deselected = activateSquare(selected, sq("D", 5));

    expect(describeActivation(selected, deselected, sq("D", 5))).toBe(
      "Red Infantry deselected.",
    );
  });
});

describe("describeActivation - no-op activation", () => {
  it("returns an empty string when nothing changed", () => {
    const session = startSession(
      initialGameState([["D5", "white", "infantry"]]),
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
      inactivityCounters: { white: 0, black: 0 },
      progressCounter: 0,
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

  it("announces an Unbreachable Flag win, replacing the 'to move' clause with the result", () => {
    const { before, after } = endingSession(
      { kind: "ongoing" },
      ["A1", "white", "infantry"],
      sq("A", 2),
      { kind: "win", winner: "white", reason: "unbreachableFlag" },
    );
    expect(describeActivation(before, after, sq("A", 2))).toBe(
      "Red Infantry moved to A2. Red wins — Blue can no longer reach Red's flag.",
    );
  });

  it("announces an Inactivity win", () => {
    const { before, after } = endingSession(
      { kind: "ongoing" },
      ["L12", "black", "infantry"],
      sq("L", 11),
      { kind: "win", winner: "black", reason: "inactivity" },
    );
    expect(describeActivation(before, after, sq("L", 11))).toBe(
      "Blue Infantry moved to L11. Blue wins — Red ran out of moves without attacking.",
    );
  });

  it("announces a No Progress draw", () => {
    const { before, after } = endingSession(
      { kind: "ongoing" },
      ["A1", "white", "infantry"],
      sq("A", 2),
      { kind: "draw", reason: "noProgress" },
    );
    expect(describeActivation(before, after, sq("A", 2))).toBe(
      "Red Infantry moved to A2. The game is a draw — No progress.",
    );
  });
});

describe("describeResult", () => {
  it("renders a win for Red with each reason, naming Blue as the losing side where the reason needs a subject", () => {
    expect(
      describeResult({ kind: "win", winner: "white", reason: "flagCapture" }),
    ).toBe("Red wins — Flag captured.");
    expect(
      describeResult({
        kind: "win",
        winner: "white",
        reason: "unbreachableFlag",
      }),
    ).toBe("Red wins — Blue can no longer reach Red's flag.");
    expect(
      describeResult({ kind: "win", winner: "white", reason: "noLegalMove" }),
    ).toBe("Red wins — Blue has no legal move left.");
    expect(
      describeResult({ kind: "win", winner: "white", reason: "inactivity" }),
    ).toBe("Red wins — Blue ran out of moves without attacking.");
  });

  it("renders a win for Blue, naming Red as the losing side", () => {
    expect(
      describeResult({ kind: "win", winner: "black", reason: "flagCapture" }),
    ).toBe("Blue wins — Flag captured.");
    expect(
      describeResult({
        kind: "win",
        winner: "black",
        reason: "unbreachableFlag",
      }),
    ).toBe("Blue wins — Red can no longer reach Blue's flag.");
    expect(
      describeResult({ kind: "win", winner: "black", reason: "noLegalMove" }),
    ).toBe("Blue wins — Red has no legal move left.");
    expect(
      describeResult({ kind: "win", winner: "black", reason: "inactivity" }),
    ).toBe("Blue wins — Red ran out of moves without attacking.");
  });

  it("renders a draw with each remaining reason", () => {
    expect(describeResult({ kind: "draw", reason: "noProgress" })).toBe(
      "The game is a draw — No progress.",
    );
    expect(describeResult({ kind: "draw", reason: "unbreachableFlag" })).toBe(
      "The game is a draw — Neither side can reach the other's flag anymore.",
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

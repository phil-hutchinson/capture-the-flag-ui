import { describe, expect, it } from "vitest";
import type { Square } from "../rules/primary/v3/board.ts";
import { PRE_RELEASE_EDITION_ID } from "../rules/primary/v3/edition.ts";
import type { GameOutcome } from "../rules/primary/v3/outcome.ts";
import { computeOutcome } from "../rules/primary/v3/outcome.ts";
import type { Rank } from "../rules/primary/v3/pieces.ts";
import type { PlayState } from "../rules/primary/v3/play.ts";
import { encodePositionId } from "../rules/primary/v3/positionId.ts";
import {
  EMPTY_POSITION,
  placePiece,
  type FlagPiece,
  type NumberedPiece,
  type PositionState,
} from "../rules/primary/v3/position.ts";
import {
  describeActivation,
  describeDrawAccepted,
  describeDrawDecline,
  describeDrawOffer,
  describeResignation,
  describeResult,
} from "./v3PlayAnnouncement.ts";
import { activateSquare, type PlaySession } from "./v3PlaySession.ts";

function whitePiece(rank: Rank): NumberedPiece {
  return { side: "white", kind: "numbered", rank };
}

function blackPiece(rank: Rank): NumberedPiece {
  return { side: "black", kind: "numbered", rank };
}

const whiteFlag: FlagPiece = { side: "white", kind: "flag" };
const blackFlag: FlagPiece = { side: "black", kind: "flag" };

/** Builds an opening `PlayState` directly from a hand-built `board`, mirroring `play.test.ts`'s helper. */
function startingStateFrom(board: PositionState): PlayState {
  const sideToMove = "white" as const;
  const inactivityCounter = 0;
  return {
    ruleset: PRE_RELEASE_EDITION_ID,
    startingBoard: board,
    startingPositionId: encodePositionId(board),
    board,
    sideToMove,
    moves: [],
    inactivityCounter,
    result: computeOutcome(board, sideToMove, inactivityCounter),
  };
}

function sessionFrom(board: PositionState): PlaySession {
  return {
    play: startingStateFrom(board),
    selection: null,
    lastOutcome: null,
    drawOffer: null,
  };
}

const A1: Square = { column: "A", row: 1 };
const D4: Square = { column: "D", row: 4 };
const D5: Square = { column: "D", row: 5 };
const H8: Square = { column: "H", row: 8 };
/** A spare white piece, far from D4/D5, so White is never left with no numbered pieces after a combat there. */
const G2: Square = { column: "G", row: 2 };
/** A spare black piece, far from D4/D5, so Black is never left with no numbered pieces after a combat there. */
const G7: Square = { column: "G", row: 7 };

describe("v3PlayAnnouncement - describeActivation - selecting a piece", () => {
  it("names the piece by colour, rank name and rank number, plus how many moves it has", () => {
    let board: PositionState = EMPTY_POSITION;
    board = placePiece(board, A1, whiteFlag);
    board = placePiece(board, D4, whitePiece(4));
    board = placePiece(board, H8, blackFlag);
    board = placePiece(board, G7, blackPiece(1));
    const session = sessionFrom(board);
    const selected = activateSquare(session, D4);

    expect(describeActivation(session, selected, D4)).toBe(
      "Red Champion, rank 4 selected, 4 moves available.",
    );
  });
});

describe("v3PlayAnnouncement - describeActivation - deselecting", () => {
  it("announces the piece being deselected", () => {
    let board: PositionState = EMPTY_POSITION;
    board = placePiece(board, A1, whiteFlag);
    board = placePiece(board, D4, whitePiece(4));
    board = placePiece(board, H8, blackFlag);
    board = placePiece(board, G7, blackPiece(1));
    const selected = activateSquare(sessionFrom(board), D4);
    const deselected = activateSquare(selected, D4);

    expect(describeActivation(selected, deselected, D4)).toBe(
      "Red Champion deselected.",
    );
  });
});

describe("v3PlayAnnouncement - describeActivation - a plain move", () => {
  it("announces the mover, its destination, and whose turn it now is - no rank digit", () => {
    let board: PositionState = EMPTY_POSITION;
    board = placePiece(board, A1, whiteFlag);
    board = placePiece(board, D4, whitePiece(4));
    board = placePiece(board, H8, blackFlag);
    board = placePiece(board, G7, blackPiece(1));
    const selected = activateSquare(sessionFrom(board), D4);
    const moved = activateSquare(selected, D5);

    expect(describeActivation(selected, moved, D5)).toBe(
      "Red Champion moved to D5. Blue to move.",
    );
  });
});

describe("v3PlayAnnouncement - describeActivation - an attack", () => {
  it("names the attacker's new rank when the attacker survives (attackerWins)", () => {
    // Black keeps a spare numbered piece (G7) so losing D5 does not end the
    // game by attrition - the trailing clause under test is "Blue to move.".
    let board: PositionState = EMPTY_POSITION;
    board = placePiece(board, A1, whiteFlag);
    board = placePiece(board, D4, whitePiece(4));
    board = placePiece(board, D5, blackPiece(2));
    board = placePiece(board, H8, blackFlag);
    board = placePiece(board, G7, blackPiece(1));
    const selected = activateSquare(sessionFrom(board), D4);
    const after = activateSquare(selected, D5);

    expect(describeActivation(selected, after, D5)).toBe(
      "Red Champion attacked Blue Militia at D5: Blue Militia falls, Red Champion advances and is demoted to Foot Soldier, rank 3. Blue to move.",
    );
  });

  it("names the defender's new rank when the defender survives (attackerLoses)", () => {
    // White keeps a spare numbered piece (G2) so losing D4 does not end the
    // game by attrition.
    let board: PositionState = EMPTY_POSITION;
    board = placePiece(board, A1, whiteFlag);
    board = placePiece(board, D4, whitePiece(2));
    board = placePiece(board, D5, blackPiece(4));
    board = placePiece(board, H8, blackFlag);
    board = placePiece(board, G2, whitePiece(1));
    const selected = activateSquare(sessionFrom(board), D4);
    const after = activateSquare(selected, D5);

    expect(describeActivation(selected, after, D5)).toBe(
      "Red Militia attacked Blue Champion at D5 and falls; Blue Champion holds and is demoted to Foot Soldier, rank 3. Blue to move.",
    );
  });

  it("names no new rank for a mutual loss - a draw reduces nothing", () => {
    // Both sides keep a spare numbered piece, since a mutual loss removes
    // both combatants at once.
    let board: PositionState = EMPTY_POSITION;
    board = placePiece(board, A1, whiteFlag);
    board = placePiece(board, D4, whitePiece(3));
    board = placePiece(board, D5, blackPiece(3));
    board = placePiece(board, H8, blackFlag);
    board = placePiece(board, G2, whitePiece(1));
    board = placePiece(board, G7, blackPiece(1));
    const selected = activateSquare(sessionFrom(board), D4);
    const after = activateSquare(selected, D5);

    expect(describeActivation(selected, after, D5)).toBe(
      "Red Foot Soldier attacked Blue Foot Soldier at D5: both fall. Blue to move.",
    );
  });

  it("names no new rank for a Flag capture - capturing the Flag is not combat - and reports the win", () => {
    // Black keeps a spare numbered piece (G7) so the game starts genuinely
    // ongoing (Black is not already in attrition before White's move).
    let board: PositionState = EMPTY_POSITION;
    board = placePiece(board, A1, whiteFlag);
    board = placePiece(board, D4, whitePiece(1));
    board = placePiece(board, D5, blackFlag);
    board = placePiece(board, G7, blackPiece(1));
    const selected = activateSquare(sessionFrom(board), D4);
    const after = activateSquare(selected, D5);

    expect(describeActivation(selected, after, D5)).toBe(
      "Red Peasant attacked Blue Flag at D5: Blue Flag falls, Red Peasant advances. Red wins — Flag captured.",
    );
  });
});

describe("v3PlayAnnouncement - describeActivation - no-op activation", () => {
  it("returns an empty string when nothing changed", () => {
    let board: PositionState = EMPTY_POSITION;
    board = placePiece(board, A1, whiteFlag);
    board = placePiece(board, D4, whitePiece(4));
    board = placePiece(board, H8, blackFlag);
    const session = sessionFrom(board);
    const unchanged = activateSquare(session, { column: "A", row: 8 });

    expect(
      describeActivation(session, unchanged, { column: "A", row: 8 }),
    ).toBe("");
  });
});

describe("v3PlayAnnouncement - describeResult", () => {
  it("renders exactly the six sentences fixed by this plan's Decision 5", () => {
    const cases: readonly [GameOutcome, string][] = [
      [
        { kind: "win", winner: "white", reason: "flagCapture" },
        "Red wins — Flag captured.",
      ],
      [
        { kind: "win", winner: "black", reason: "attrition" },
        "Blue wins — Red has no pieces left.",
      ],
      [
        { kind: "draw", reason: "mutualAttrition" },
        "The game is a draw — neither player has any pieces left.",
      ],
      [
        { kind: "draw", reason: "inactivity" },
        "The game is a draw — by inactivity.",
      ],
      [
        { kind: "win", winner: "black", reason: "resignation" },
        "Blue wins — Red resigned.",
      ],
      [
        { kind: "draw", reason: "agreement" },
        "The game is a draw — by agreement.",
      ],
    ];

    for (const [result, expected] of cases) {
      expect(describeResult(result)).toBe(expected);
    }
  });

  it("returns an empty string for an ongoing game", () => {
    expect(describeResult({ kind: "ongoing" })).toBe("");
  });
});

describe("v3PlayAnnouncement - describeDrawOffer / describeDrawDecline / describeDrawAccepted", () => {
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
  });

  it("reuses the result-and-reason sentence for an accepted draw", () => {
    expect(describeDrawAccepted({ kind: "draw", reason: "agreement" })).toBe(
      "The game is a draw — by agreement.",
    );
  });
});

describe("v3PlayAnnouncement - describeResignation", () => {
  it("reuses the result-and-reason sentence for a resignation", () => {
    expect(
      describeResignation({
        kind: "win",
        winner: "black",
        reason: "resignation",
      }),
    ).toBe("Blue wins — Red resigned.");
  });
});

import { describe, expect, it } from "vitest";
import type { Square } from "../rules/primary/v1_1/board.ts";
import { RULESET_TAG } from "../rules/primary/v1_1/gameState.ts";
import type {
  BoardState,
  InitialGameState,
  PlacedPiece,
} from "../rules/primary/v1_1/gameState.ts";
import type { PieceTypeId } from "../rules/primary/v1_1/pieces.ts";
import { describeActivation } from "./playAnnouncement.ts";
import { activateSquare, startSession } from "./playSession.ts";

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
      initialGameState([["D5", "white", "infantry"]]),
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
      initialGameState([["D5", "white", "infantry"]]),
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

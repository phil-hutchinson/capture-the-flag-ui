import { describe, expect, it } from "vitest";
import type {
  BoardState,
  PlacedPiece,
} from "../rules/primary/v1_1/gameState.ts";
import type {
  ParsedRecord,
  RecordedPly,
} from "../rules/primary/v1_1/recordFile.ts";
import {
  replayRecord,
  type ReplayedRecord,
} from "../rules/primary/v1_1/replay.ts";
import {
  createReviewSession,
  currentBoard,
  describeCurrentPosition,
  isAtEnd,
  isAtStart,
  jumpToEnd,
  jumpToMove,
  jumpToStart,
  lastMove,
  stepBack,
  stepForward,
  type ReviewSession,
} from "./reviewSession.ts";

const WHITE_ATTACKER: PlacedPiece = { side: "white", pieceType: "sapper" };
const BLACK_DEFENDER: PlacedPiece = { side: "black", pieceType: "tower" };
const BLACK_WANDERER: PlacedPiece = { side: "black", pieceType: "infantry" };

/** A small hand-built three-move game: a capture, a quiet move by the other side, then a quiet move continuing from the capture. */
function buildGame(): ReplayedRecord {
  const startingBoard: BoardState = {
    A1: WHITE_ATTACKER,
    A2: BLACK_DEFENDER,
    B12: BLACK_WANDERER,
  };
  const moves: readonly RecordedPly[] = [
    {
      ply: 1,
      round: 1,
      side: "white",
      token: "A1-A2x",
      move: {
        from: { column: "A", row: 1 },
        to: { column: "A", row: 2 },
        fromRemoved: false,
        toRemoved: true,
      },
    },
    {
      ply: 2,
      round: 1,
      side: "black",
      token: "B12-B11",
      move: {
        from: { column: "B", row: 12 },
        to: { column: "B", row: 11 },
        fromRemoved: false,
        toRemoved: false,
      },
    },
    {
      ply: 3,
      round: 2,
      side: "white",
      token: "A2-A3",
      move: {
        from: { column: "A", row: 2 },
        to: { column: "A", row: 3 },
        fromRemoved: false,
        toRemoved: false,
      },
    },
  ];
  const parsed: ParsedRecord = {
    tags: { ruleset: "PRIMARY:1.1" },
    startingBoard,
    moves,
  };
  const result = replayRecord(parsed);
  expect(result.kind).toBe("replayed");
  return (result as { kind: "replayed"; record: ReplayedRecord }).record;
}

describe("createReviewSession", () => {
  it("starts at the opening position", () => {
    const session = createReviewSession(buildGame());
    expect(session.cursor).toBe(0);
    expect(currentBoard(session)).toEqual(session.record.positions[0]);
    expect(isAtStart(session)).toBe(true);
    expect(isAtEnd(session)).toBe(false);
    expect(lastMove(session)).toBeNull();
  });
});

describe("stepForward / stepBack", () => {
  it("walk the positions in order and are exact inverses of one another", () => {
    const game = buildGame();
    let session: ReviewSession = createReviewSession(game);

    for (let cursor = 1; cursor <= game.moves.length; cursor += 1) {
      session = stepForward(session);
      expect(session.cursor).toBe(cursor);
      expect(currentBoard(session)).toEqual(game.positions[cursor]);
    }

    for (let cursor = game.moves.length - 1; cursor >= 0; cursor -= 1) {
      session = stepBack(session);
      expect(session.cursor).toBe(cursor);
      expect(currentBoard(session)).toEqual(game.positions[cursor]);
    }
  });

  it("stepBack at the opening position is a no-op", () => {
    const session = createReviewSession(buildGame());
    expect(stepBack(session)).toEqual(session);
  });

  it("stepForward at the final position is a no-op", () => {
    const session = jumpToEnd(createReviewSession(buildGame()));
    expect(stepForward(session)).toEqual(session);
  });
});

describe("jumpToStart / jumpToEnd", () => {
  it("jumpToStart reaches the first position from anywhere", () => {
    const game = buildGame();
    const session = stepForward(stepForward(createReviewSession(game)));
    const started = jumpToStart(session);
    expect(started.cursor).toBe(0);
    expect(currentBoard(started)).toEqual(game.positions[0]);
    expect(isAtStart(started)).toBe(true);
  });

  it("jumpToEnd reaches the last position from anywhere", () => {
    const game = buildGame();
    const session = createReviewSession(game);
    const ended = jumpToEnd(session);
    expect(ended.cursor).toBe(game.moves.length);
    expect(currentBoard(ended)).toEqual(game.positions[game.moves.length]);
    expect(isAtEnd(ended)).toBe(true);
  });
});

describe("jumpToMove", () => {
  it("lands on the position after the given move", () => {
    const game = buildGame();
    const session = createReviewSession(game);

    const afterFirst = jumpToMove(session, 0);
    expect(afterFirst.cursor).toBe(1);
    expect(currentBoard(afterFirst)).toEqual(game.positions[1]);

    const afterSecond = jumpToMove(session, 1);
    expect(afterSecond.cursor).toBe(2);
    expect(currentBoard(afterSecond)).toEqual(game.positions[2]);

    const afterThird = jumpToMove(session, 2);
    expect(afterThird.cursor).toBe(3);
    expect(currentBoard(afterThird)).toEqual(game.positions[3]);
  });

  it("clamps a negative index to the opening position", () => {
    const game = buildGame();
    const session = jumpToMove(createReviewSession(game), -5);
    expect(session.cursor).toBe(0);
  });

  it("clamps an index past the end of the game to the final position", () => {
    const game = buildGame();
    const session = jumpToMove(createReviewSession(game), 999);
    expect(session.cursor).toBe(game.moves.length);
  });
});

describe("currentBoard", () => {
  it("equals the replayed position at every cursor", () => {
    const game = buildGame();
    let session: ReviewSession = createReviewSession(game);
    expect(currentBoard(session)).toEqual(game.positions[0]);

    for (let index = 0; index < game.moves.length; index += 1) {
      session = jumpToMove(createReviewSession(game), index);
      expect(currentBoard(session)).toEqual(game.positions[index + 1]);
    }
  });
});

describe("lastMove", () => {
  it("is null at the opening position", () => {
    const session = createReviewSession(buildGame());
    expect(lastMove(session)).toBeNull();
  });

  it("names the right move and squares at each cursor", () => {
    const game = buildGame();
    const session = createReviewSession(game);

    const afterFirst = jumpToMove(session, 0);
    expect(lastMove(afterFirst)).toEqual({
      ...game.moves[0],
      boardAfter: game.positions[1],
    });
    expect(lastMove(afterFirst)?.move.from).toEqual({ column: "A", row: 1 });
    expect(lastMove(afterFirst)?.move.to).toEqual({ column: "A", row: 2 });

    const afterSecond = jumpToMove(session, 1);
    expect(lastMove(afterSecond)?.token).toBe("B12-B11");
    expect(lastMove(afterSecond)?.side).toBe("black");

    const afterThird = jumpToMove(session, 2);
    expect(lastMove(afterThird)?.token).toBe("A2-A3");
    expect(lastMove(afterThird)?.round).toBe(2);
  });
});

describe("describeCurrentPosition", () => {
  it("reads 'Opening position' at the start", () => {
    const session = createReviewSession(buildGame());
    expect(describeCurrentPosition(session)).toBe("Opening position");
  });

  it("names the move, round and color once a move has been made", () => {
    const game = buildGame();
    const session = jumpToMove(createReviewSession(game), 0);
    expect(describeCurrentPosition(session)).toBe("Move 1 of 3 — round 1, red");
  });

  it("reflects the final move at the end of the game", () => {
    const session = jumpToEnd(createReviewSession(buildGame()));
    expect(describeCurrentPosition(session)).toBe("Move 3 of 3 — round 2, red");
  });
});

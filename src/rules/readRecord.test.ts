import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Edition } from "./primary/v2/edition.ts";
import { EDITIONS } from "./primary/v2/edition.ts";
import { columnLetter } from "./primary/v2/boardLayout.ts";
import {
  configureRules,
  deviatingFlags,
  renderRulesetTag,
  STANDARD_BATTLE_CONFIGURATION,
  type RuleConfiguration,
} from "./primary/v2/configuration.ts";
import {
  renderPositionBlock,
  RULESET_TAG,
  type InitialGameState,
} from "./primary/v2/gameState.ts";
import { renderMoveToken } from "./primary/v2/notation.ts";
import type { PieceTypeId } from "./primary/v2/pieces.ts";
import { applyMove, renderGameRecord, startPlay } from "./primary/v2/play.ts";
import { readRecord } from "./readRecord.ts";

// Story 00000025's registry adds a third edition: the active `2-1:SKIRMISH`
// (what a *new* Skirmish game is set up, played, and recorded as) and the
// superseded `2-0:SKIRMISH` (still resolvable, so a record naming it keeps
// reviewing, but no longer offered as a game to start - see edition.ts).
// Fixtures below that predate that split and were only ever standing in for
// "a Skirmish record" now use `2-1:SKIRMISH`, matching what the app actually
// produces going forward; `2-0:SKIRMISH` stays wherever a test deliberately
// exercises the *historical* path - the "accepts all three registered
// edition tags" block below, and the checked-in
// `doc/samples/2-0-skirmish-tower-in-lane.txt` fixture's own describe block,
// which is this story's pinned proof that placement rules never leak into
// replay.

const GAME_STATE: InitialGameState = {
  ruleset: RULESET_TAG,
  configuration: STANDARD_BATTLE_CONFIGURATION,
  board: {
    A1: { side: "white", pieceType: "flag" },
  },
};
const POSITION_BLOCK = renderPositionBlock(GAME_STATE);

describe("readRecord - edition dispatch", () => {
  it("rejects a retired 1.2:PRE-RELEASE record as an unknown ruleset", () => {
    // Story 00000023's Policy: major 2 is a go-forward replacement, not an
    // addition - there is no reader for the old tag any more, so a
    // 1.2:PRE-RELEASE file falls straight through to the same rejection as
    // any other name this app does not recognize (major-1 records are
    // deliberately not reviewable).
    const text = ['[Ruleset "1.2:PRE-RELEASE"]', POSITION_BLOCK].join("\n\n");

    expect(readRecord(text)).toEqual({
      kind: "error",
      error: { kind: "unknownRuleset", ruleset: "1.2:PRE-RELEASE" },
    });
  });

  it("rejects a recognized-but-unknown ruleset version", () => {
    const text = ['[Ruleset "PRIMARY:2.0"]', POSITION_BLOCK].join("\n\n");

    expect(readRecord(text)).toEqual({
      kind: "error",
      error: { kind: "unknownRuleset", ruleset: "PRIMARY:2.0" },
    });
  });

  it("rejects a PRIMARY:1.1-tagged record as an unknown ruleset", () => {
    // Story 00000016: 1.2 replaced 1.1 outright, and story 00000023 replaced
    // 1.2 outright in turn - no 1.1 reader has ever existed, and a 1.1 file
    // is honestly rejected as unrecognized, not mistaken for anything else.
    const text = ['[Ruleset "PRIMARY:1.1"]', POSITION_BLOCK].join("\n\n");

    expect(readRecord(text)).toEqual({
      kind: "error",
      error: { kind: "unknownRuleset", ruleset: "PRIMARY:1.1" },
    });
  });

  it("rejects an entirely different ruleset name", () => {
    const text = ['[Ruleset "SOMETHING_ELSE:1.0"]', POSITION_BLOCK].join(
      "\n\n",
    );

    expect(readRecord(text)).toEqual({
      kind: "error",
      error: { kind: "unknownRuleset", ruleset: "SOMETHING_ELSE:1.0" },
    });
  });

  it("rejects a file with no readable Ruleset tag as not a game record", () => {
    const text = "Just a photo, or some other file - not a game record.";

    expect(readRecord(text)).toEqual({
      kind: "error",
      error: { kind: "notARecord" },
    });
  });

  it("surfaces the delegated reader's own structural errors", () => {
    const text = ['[Ruleset "2-0:BATTLE"]', "not a valid position block"].join(
      "\n\n",
    );

    const result = readRecord(text);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.error.kind).toBe("recordFile");
    }
  });

  it("replays a well-formed record, and surfaces the delegated reader's own replay errors", () => {
    // A move from an empty square: the file parses cleanly (it is
    // structurally a valid record) but cannot be replayed to the end - so
    // reading it is a rejection, not a part-loaded game.
    const text = ['[Ruleset "2-0:BATTLE"]', POSITION_BLOCK, "1. B1-B2"].join(
      "\n\n",
    );

    const result = readRecord(text);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.error).toEqual({
        kind: "replay",
        error: {
          kind: "emptySource",
          ply: 1,
          round: 1,
          side: "white",
          token: "B1-B2",
          square: { column: "B", row: 1 },
        },
      });
    }
  });
});

// Small, hand-built 2-0:BATTLE records exercising the full parse-then-replay
// round trip end to end (story 00000016 Step 8, retargeted from
// 1.2:PRE-RELEASE to 2-0:BATTLE by story 00000023's Step 8 - the ruleset
// tag flip - ahead of story 00000017's real engine-produced fixtures).
// Deliberately not a realistic game (a piece "attacking" from several
// squares away, say) - replay.ts is rules-blind by design (see its header
// comment), so these fixtures only need to be *internally consistent*, not
// legal under the movement/combat rules; the point is round-trip honesty
// between the writer's format and this reader.
describe("readRecord - a small synthetic 2-0:BATTLE record round-trips", () => {
  const ROUND_TRIP_GAME_STATE: InitialGameState = {
    ruleset: RULESET_TAG,
    configuration: STANDARD_BATTLE_CONFIGURATION,
    board: {
      A1: { side: "white", pieceType: "masterOfArms" },
      B1: { side: "white", pieceType: "champion" },
      C1: { side: "white", pieceType: "tower" },
      D1: { side: "white", pieceType: "flag" },
      A9: { side: "black", pieceType: "knight" },
      B9: { side: "black", pieceType: "militia" },
    },
  };
  const ROUND_TRIP_POSITION_BLOCK = renderPositionBlock(ROUND_TRIP_GAME_STATE);

  // Round 1: a quiet move for each side.
  const WHITE_1 = renderMoveToken({
    from: { column: "A", row: 1 },
    to: { column: "A", row: 2 },
    fromRemoved: false,
    toRemoved: false,
  });
  const BLACK_1 = renderMoveToken({
    from: { column: "A", row: 9 },
    to: { column: "A", row: 8 },
    fromRemoved: false,
    toRemoved: false,
  });
  // Round 2: White's masterOfArms wins an attack (the defender is removed,
  // the attacker advances); Black plays another quiet move.
  const WHITE_2 = renderMoveToken({
    from: { column: "A", row: 2 },
    to: { column: "A", row: 8 },
    fromRemoved: false,
    toRemoved: true,
  });
  const BLACK_2 = renderMoveToken({
    from: { column: "B", row: 9 },
    to: { column: "B", row: 8 },
    fromRemoved: false,
    toRemoved: false,
  });
  // Round 3: a mutual loss - both pieces removed - as White's trailing move
  // (the final round of the file, so it carries no Black move).
  const WHITE_3 = renderMoveToken({
    from: { column: "A", row: 8 },
    to: { column: "B", row: 8 },
    fromRemoved: true,
    toRemoved: true,
  });

  it("accepts the record and replays every move to the final position", () => {
    const text = [
      [
        '[Ruleset "2-0:BATTLE"]',
        '[Result "1-0"]',
        '[ResultReason "Flag Captured"]',
      ].join("\n"),
      ROUND_TRIP_POSITION_BLOCK,
      [
        `1. ${WHITE_1} ${BLACK_1}`,
        `2. ${WHITE_2} ${BLACK_2}`,
        `3. ${WHITE_3}`,
      ].join("\n"),
    ].join("\n\n");

    const result = readRecord(text);
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }
    const { record } = result;

    expect(record.tags).toEqual({
      ruleset: "2-0:BATTLE",
      result: "1-0",
      resultReason: "Flag Captured",
    });
    expect(record.positions).toHaveLength(6);
    expect(record.positions[0]).toEqual(ROUND_TRIP_GAME_STATE.board);

    const finalPosition = record.positions[record.positions.length - 1];
    expect(finalPosition).toEqual({
      B1: { side: "white", pieceType: "champion" },
      C1: { side: "white", pieceType: "tower" },
      D1: { side: "white", pieceType: "flag" },
    });

    expect(record.moves).toHaveLength(5);
    expect(record.moves.map((move) => move.token)).toEqual([
      WHITE_1,
      BLACK_1,
      WHITE_2,
      BLACK_2,
      WHITE_3,
    ]);
    expect(record.moves[4]).toMatchObject({
      ply: 5,
      round: 3,
      side: "white",
    });
  });

  it("rejects an intentionally malformed 2-0:BATTLE record (an unmarked capture)", () => {
    // The destination is occupied by a second piece the move token never
    // marks as removed - structurally a valid record, but not one that can
    // be carried out: a corrupted or hand-edited record, not a different
    // ruleset's.
    const malformedState: InitialGameState = {
      ruleset: RULESET_TAG,
      configuration: STANDARD_BATTLE_CONFIGURATION,
      board: {
        A1: { side: "white", pieceType: "masterOfArms" },
        A2: { side: "white", pieceType: "champion" },
      },
    };
    const text = [
      '[Ruleset "2-0:BATTLE"]',
      renderPositionBlock(malformedState),
      "1. A1-A2",
    ].join("\n\n");

    const result = readRecord(text);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.error).toEqual({
        kind: "replay",
        error: {
          kind: "unmarkedCapture",
          ply: 1,
          round: 1,
          side: "white",
          token: "A1-A2",
          square: { column: "A", row: 2 },
        },
      });
    }
  });
});

// Gate D defect fix (owner-reported): "Review a game" was rendering every
// imported record on a Battle (12x12) board regardless of its own edition,
// because `ReviewScreen.tsx` called `FullBoard` with no `layout` prop at all
// and `FullBoard`'s optional `layout` defaults to Battle's. `readRecord.ts`
// already resolved the record's `Ruleset` tag to an `Edition` (to size the
// position block correctly) but discarded it once parsing was done. It now
// surfaces that `Edition` on `ReadRecordResult`'s "parsed" case, threaded by
// `ImportScreen.tsx`/`App.tsx` to `ReviewScreen.tsx`. These tests cover the
// reader's half of the fix - that the *right* edition (board dimensions and
// lake layout) comes back for each ruleset, not just Battle's.
describe("readRecord - surfaces the record's own resolved Edition (Gate D defect fix)", () => {
  it.each([
    ["2-0:BATTLE", EDITIONS["2-0:BATTLE"], 12, 12] as const,
    ["2-1:SKIRMISH", EDITIONS["2-1:SKIRMISH"], 8, 8] as const,
  ])(
    "surfaces %s's own board dimensions, not Battle's default",
    (id, edition, columnCount, rowCount) => {
      const initial: InitialGameState = {
        ruleset: edition.id,
        configuration: configureRules(edition),
        board: {
          A1: { side: "white", pieceType: "flag" },
        },
      };
      const text = renderGameRecord(startPlay(initial));

      const result = readRecord(text);
      expect(result.kind).toBe("parsed");
      if (result.kind !== "parsed") {
        return;
      }

      expect(result.configuration.edition.id).toBe(id);
      expect(result.configuration.edition.boardLayout.columnCount).toBe(
        columnCount,
      );
      expect(result.configuration.edition.boardLayout.rowCount).toBe(rowCount);
    },
  );

  it("surfaces Skirmish's own lake cells (rows 4-5, columns B/C/F/G), not Battle's (rows 6-7, B/C/F/G/J/K)", () => {
    const skirmish = EDITIONS["2-1:SKIRMISH"];
    const initial: InitialGameState = {
      ruleset: skirmish.id,
      configuration: configureRules(skirmish),
      board: { A1: { side: "white", pieceType: "flag" } },
    };

    const result = readRecord(renderGameRecord(startPlay(initial)));
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }

    expect(result.configuration.edition.boardLayout.lakeRows).toEqual([4, 5]);
    expect(
      result.configuration.edition.boardLayout.lakeColumnIndices.map(
        columnLetter,
      ),
    ).toEqual(["B", "C", "F", "G"]);
  });

  it("surfaces Battle's own lake cells (rows 6-7), unaffected by the fix", () => {
    const battle = EDITIONS["2-0:BATTLE"];
    const initial: InitialGameState = {
      ruleset: battle.id,
      configuration: configureRules(battle),
      board: { A1: { side: "white", pieceType: "flag" } },
    };

    const result = readRecord(renderGameRecord(startPlay(initial)));
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }

    expect(result.configuration.edition.boardLayout.lakeRows).toEqual([6, 7]);
    expect(
      result.configuration.edition.boardLayout.lakeColumnIndices.map(
        columnLetter,
      ),
    ).toEqual(["B", "C", "F", "G", "J", "K"]);
  });
});

// Story 00000023's Step 8: the writer (`renderGameRecord`/`renderPositionBlock`,
// gameState.ts/play.ts) and this reader round-trip both published editions
// end to end - the `Ruleset` tag is the full edition id with no deviating
// flags, and the reader recovers the position block's dimensions and lake
// layout from that edition's `BoardLayout` rather than assuming Battle's
// fixed 12x12 grid. At Step 8, `renderGameRecord` still wrote the plain move
// form (`A2A3`, no separator), which this reader deliberately does not
// accept (`parseMoveToken`'s `"plainNotation"` rejection, notation.ts), so
// Step 8 itself only exercised a *freshly started* game here (no moves, so
// no move section is even written) - switching the writer to the extended
// form was the standing "emitted record notation" backburner item (this
// story's story.md, "Out of scope"), out of Step 8's own scope. **Step 8a**
// brought that item into scope: `applyMove` (play.ts) now records each move
// in the extended form (`renderMoveToken`, notation.ts) as it is applied, so
// `renderGameRecord`'s own move sequence is extended-notation too. The block
// below still round-trips the *opening* record (tag + position block, no
// moves yet); the hand-built extended-notation move sequence after it
// (mirroring the existing 2-0:BATTLE synthetic-record tests above) exercises
// the reader directly, independent of the writer; and the
// "a played game's moves round-trip through the real writer" block further
// below drives `startPlay`/`applyMove`/`renderGameRecord` through a full
// played game on both editions - Step 8a's own required coverage, including
// a move that removed one piece and a move that removed both. Verifying the
// reviewer against *real* engine-produced 2.0 records is out of scope here (a
// follow-up story, per story.md's "Split delivery"); these round trips are
// entirely app-produced.
describe("readRecord - renderGameRecord's opening-position output round-trips for both editions", () => {
  it.each([
    ["2-0:BATTLE", EDITIONS["2-0:BATTLE"], 12] as const,
    ["2-1:SKIRMISH", EDITIONS["2-1:SKIRMISH"], 8] as const,
  ])("round-trips a freshly started %s game", (id, edition, size) => {
    const initial: InitialGameState = {
      ruleset: edition.id,
      configuration: configureRules(edition),
      board: {
        A1: { side: "white", pieceType: "flag" },
      },
    };
    const state = startPlay(initial);

    const text = renderGameRecord(state);
    expect(text).toContain(`[Ruleset "${id}"]`);

    const result = readRecord(text);
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }

    expect(result.record.tags.ruleset).toBe(id);
    // The position block is size-describing - this confirms the reader
    // recovered this edition's own dimensions from it, not Battle's.
    const blockLines = renderPositionBlock(initial).split("\n");
    expect(blockLines).toHaveLength(size);
    for (const line of blockLines) {
      expect(line.split(" ")).toHaveLength(size);
    }
    expect(result.record.positions).toEqual([initial.board]);
    expect(result.record.moves).toEqual([]);
  });
});

// Story 00000025: the registry now holds three editions - `2-0:BATTLE` and
// `2-1:SKIRMISH` (active) plus the superseded `2-0:SKIRMISH` (still
// resolvable, per `EDITIONS`, so a record naming it keeps reviewing even
// though it is no longer offered as a game to start). This confirms
// `readRecord` accepts all three tags and still rejects an unknown one.
describe("readRecord - accepts all three registered edition tags (story 00000025)", () => {
  it.each([
    ["2-0:BATTLE", EDITIONS["2-0:BATTLE"]] as const,
    ["2-1:SKIRMISH", EDITIONS["2-1:SKIRMISH"]] as const,
    ["2-0:SKIRMISH", EDITIONS["2-0:SKIRMISH"]] as const,
  ])("accepts a record tagged %s", (id, edition) => {
    const initial: InitialGameState = {
      ruleset: edition.id,
      configuration: configureRules(edition),
      board: { A1: { side: "white", pieceType: "flag" } },
    };

    const result = readRecord(renderGameRecord(startPlay(initial)));
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }
    expect(result.record.tags.ruleset).toBe(id);
    expect(result.configuration.edition.id).toBe(id);
  });

  it("still rejects an unknown ruleset tag", () => {
    const text = ['[Ruleset "9-9:NOT_A_REAL_EDITION"]', POSITION_BLOCK].join(
      "\n\n",
    );

    expect(readRecord(text)).toEqual({
      kind: "error",
      error: { kind: "unknownRuleset", ruleset: "9-9:NOT_A_REAL_EDITION" },
    });
  });
});

describe("readRecord - a small synthetic 2-1:SKIRMISH record round-trips (8x8)", () => {
  const skirmish = EDITIONS["2-1:SKIRMISH"];
  const SKIRMISH_GAME_STATE: InitialGameState = {
    ruleset: skirmish.id,
    configuration: configureRules(skirmish),
    board: {
      A1: { side: "white", pieceType: "masterOfArms" },
      B1: { side: "white", pieceType: "champion" },
      D1: { side: "white", pieceType: "flag" },
      A8: { side: "black", pieceType: "knight" },
      B8: { side: "black", pieceType: "tower" },
    },
  };
  const SKIRMISH_POSITION_BLOCK = renderPositionBlock(SKIRMISH_GAME_STATE);

  // A1 -> A8: the length of this 8x8 board's own column, well past Battle's
  // squares on the same column - deliberately not a legal ply under the
  // movement rules (replay.ts is rules-blind by design; see the 2-0:BATTLE
  // fixtures above), but proof the reader accepts a destination row that
  // only exists on Skirmish's own 8-row board. The defender is removed
  // (Black's knight captured).
  const WHITE_1 = renderMoveToken({
    from: { column: "A", row: 1 },
    to: { column: "A", row: 8 },
    fromRemoved: false,
    toRemoved: true,
  });
  const BLACK_1 = renderMoveToken({
    from: { column: "B", row: 8 },
    to: { column: "B", row: 1 },
    fromRemoved: false,
    toRemoved: true,
  });

  it("accepts the record and replays to the final position on the 8x8 board", () => {
    const text = [
      [
        '[Ruleset "2-1:SKIRMISH"]',
        '[Result "0-1"]',
        '[ResultReason "Flag Captured"]',
      ].join("\n"),
      SKIRMISH_POSITION_BLOCK,
      `1. ${WHITE_1} ${BLACK_1}`,
    ].join("\n\n");

    const result = readRecord(text);
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }
    const { record } = result;

    expect(record.tags).toEqual({
      ruleset: "2-1:SKIRMISH",
      result: "0-1",
      resultReason: "Flag Captured",
    });
    expect(record.positions).toHaveLength(3);
    expect(record.positions[0]).toEqual(SKIRMISH_GAME_STATE.board);
    expect(record.positions[1]).toEqual({
      B1: { side: "white", pieceType: "champion" },
      D1: { side: "white", pieceType: "flag" },
      A8: { side: "white", pieceType: "masterOfArms" },
      B8: { side: "black", pieceType: "tower" },
    });
    expect(record.positions[2]).toEqual({
      D1: { side: "white", pieceType: "flag" },
      A8: { side: "white", pieceType: "masterOfArms" },
      B1: { side: "black", pieceType: "tower" },
    });
    expect(record.moves.map((move) => move.token)).toEqual([WHITE_1, BLACK_1]);
  });
});

// Story 00000023's Step 8a: `applyMove` now records each move in the record
// format's extended notation as it is applied, so `renderGameRecord`'s output
// for a *played* game (not just a freshly started one) is something this
// app's own reader can read back - the very thing Gate D's "re-import that
// dump into the reviewer" clause needs. These tests drive the real writer
// (`startPlay`/`applyMove`/`renderGameRecord`) rather than hand-building
// extended-notation tokens, on both published editions, through a move that
// removes exactly one piece (the attacker wins) and a move that removes both
// (a mutual loss) - the two shapes `renderMoveToken` can mark on a `-`, and
// exactly the outcome information the plain form used to drop. The squares
// used (columns A-E, rows 1-3) are ordinary home-zone ground on both editions
// (never a lake row on either `BoardLayout`), so the same fixture is valid
// for both board sizes without adjustment.
describe("readRecord - a played game's moves round-trip through the real writer (Step 8a)", () => {
  function playedGame(edition: Edition): {
    readonly initial: InitialGameState;
    readonly text: string;
    readonly finalBoard: InitialGameState["board"];
  } {
    const initial: InitialGameState = {
      ruleset: edition.id,
      configuration: configureRules(edition),
      board: {
        A1: { side: "white", pieceType: "flag" },
        E3: { side: "black", pieceType: "flag" },
        A2: { side: "white", pieceType: "champion" }, // rank 2
        A3: { side: "black", pieceType: "militia" }, // rank 6 - weaker
        C2: { side: "white", pieceType: "militia" }, // rank 6
        C3: { side: "black", pieceType: "militia" }, // rank 6 - equal
      },
    };
    let state = startPlay(initial);
    // White's champion attacks Black's militia: attacker wins - one piece
    // (the defender) is removed.
    state = applyMove(
      state,
      { column: "A", row: 2 },
      { column: "A", row: 3 },
    ).state;
    // Black's militia attacks White's militia: equal rank - both pieces are
    // removed (mutual loss).
    state = applyMove(
      state,
      { column: "C", row: 3 },
      { column: "C", row: 2 },
    ).state;

    return { initial, text: renderGameRecord(state), finalBoard: state.board };
  }

  it.each([
    ["2-0:BATTLE", EDITIONS["2-0:BATTLE"]] as const,
    ["2-1:SKIRMISH", EDITIONS["2-1:SKIRMISH"]] as const,
  ])(
    "round-trips a played %s game, including a one-piece and a two-piece removal",
    (id, edition) => {
      const { initial, text, finalBoard } = playedGame(edition);

      // The writer itself now emits the extended form - a plain-form move
      // token never appears in its output.
      expect(text).toContain("1. A2-A3x C3x-C2x");

      const result = readRecord(text);
      expect(result.kind).toBe("parsed");
      if (result.kind !== "parsed") {
        return;
      }

      expect(result.record.tags.ruleset).toBe(id);
      expect(result.record.positions[0]).toEqual(initial.board);
      expect(result.record.moves.map((move) => move.token)).toEqual([
        "A2-A3x",
        "C3x-C2x",
      ]);

      const replayedFinalPosition =
        result.record.positions[result.record.positions.length - 1];
      expect(replayedFinalPosition).toEqual(finalBoard);
      expect(replayedFinalPosition).toEqual({
        A1: { side: "white", pieceType: "flag" },
        E3: { side: "black", pieceType: "flag" },
        A3: { side: "white", pieceType: "champion" },
      });
    },
  );
});

// Story 00000025, Step 6: confirms - with a test, not by inspection - that a
// *finished* game's record carries the edition it was actually played under,
// for each active edition, and that nothing else about the record format
// (the position block, the Result/ResultReason tags, the move notation)
// differs between them. Skirmish now carries its own minor (`2-1:SKIRMISH`),
// distinct from Battle's (`2-0:BATTLE`) - this is the in-scope guarantee
// story.md's item 6 asks for.
describe("readRecord - a finished game's record carries its own edition's Ruleset tag (story 00000025)", () => {
  it.each([
    ["2-0:BATTLE", EDITIONS["2-0:BATTLE"]] as const,
    ["2-1:SKIRMISH", EDITIONS["2-1:SKIRMISH"]] as const,
  ])(
    "a finished %s game's record round-trips with its own tag, Result and ResultReason intact",
    (id, edition) => {
      const initial: InitialGameState = {
        ruleset: edition.id,
        configuration: configureRules(edition),
        board: {
          A1: { side: "white", pieceType: "flag" },
          D2: { side: "white", pieceType: "champion" },
          D3: { side: "black", pieceType: "flag" },
        },
      };
      const state = startPlay(initial);
      // White's champion captures Black's flag: an immediate win, on both
      // board sizes (columns A-D, rows 1-3 are ordinary home-zone ground on
      // both editions - never a lake row on either `BoardLayout`).
      const { state: finished } = applyMove(
        state,
        { column: "D", row: 2 },
        { column: "D", row: 3 },
      );

      const text = renderGameRecord(finished);
      expect(text).toContain(`[Ruleset "${id}"]`);
      expect(text).toContain('[Result "1-0"]');
      expect(text).toContain('[ResultReason "Flag Captured"]');
      expect(text).toContain(renderPositionBlock(initial));

      const result = readRecord(text);
      expect(result.kind).toBe("parsed");
      if (result.kind !== "parsed") {
        return;
      }

      expect(result.record.tags).toEqual({
        ruleset: id,
        result: "1-0",
        resultReason: "Flag Captured",
      });
      expect(result.configuration.edition.id).toBe(id);
      expect(result.record.positions[0]).toEqual(initial.board);
      expect(result.record.moves.map((move) => move.token)).toEqual(["D2-D3x"]);
    },
  );
});

// Story 00000025, Step 6: the checked-in `doc/samples/` fixture pins the
// story's central guarantee - a `2-0:SKIRMISH` record whose *starting
// position* has a Tower directly in front of a lane (A3, legal under the
// historical edition, refused at placement time under `2-1:SKIRMISH`) must
// still parse and replay to the end without complaint, because placement
// rules are only ever consulted while a player is placing, never during
// replay (`src/rules/primary/v2/replay.ts`/`recordFile.ts` know nothing
// about `TOWER_PLACEMENT`). Reading the file from disk (rather than
// hand-building the same text inline) is deliberate - it is the same file
// the owner imports at this story's manual Gate D, so the automated
// guarantee and the manually-verified artifact can never drift apart. See
// `doc/samples/README.md` for what the fixture is and how it was built.
describe("readRecord - the checked-in doc/samples/2-0-skirmish-tower-in-lane.txt fixture (story 00000025, Step 6)", () => {
  const SAMPLE_PATH = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../doc/samples/2-0-skirmish-tower-in-lane.txt",
  );
  const sampleText = readFileSync(SAMPLE_PATH, "utf8");

  it("parses and replays to the end even though its starting position has a Tower in front of a lane", () => {
    const result = readRecord(sampleText);
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }

    expect(result.record.tags.ruleset).toBe("2-0:SKIRMISH");
    expect(result.record.tags.result).toBe("1-0");
    expect(result.record.tags.resultReason).toBe("Flag Captured");
    expect(result.record.positions[0].A3).toEqual({
      side: "white",
      pieceType: "tower",
    });
    // Replayed to the end: the opening position plus one played ply.
    expect(result.record.positions).toHaveLength(2);
    expect(result.record.moves).toHaveLength(1);
  });

  it("the mirror case: the same starting position also replays without complaint tagged 2-1:SKIRMISH, proving replay never checks placement even under the edition that would refuse this Tower", () => {
    const activeText = sampleText.replace(
      '[Ruleset "2-0:SKIRMISH"]',
      '[Ruleset "2-1:SKIRMISH"]',
    );
    expect(activeText).not.toBe(sampleText);

    const result = readRecord(activeText);
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }

    expect(result.record.tags.ruleset).toBe("2-1:SKIRMISH");
    expect(result.record.positions[0].A3).toEqual({
      side: "white",
      pieceType: "tower",
    });
    expect(result.record.positions).toHaveLength(2);
  });
});

// Story 00000027, Step 6: closes the loop opened at Step 3 - a `Ruleset` tag
// can now name deviating flags, and this is where the reader learns to
// understand them. Each case below drives the real writer
// (`startPlay`/`applyMove`/`renderGameRecord`) under a non-standard
// `RuleConfiguration` built via `configureRules`, exactly like Step 4/5's own
// `applyMove` fixtures (`play.test.ts`) - D5 white champion attacking E6, its
// diagonal neighbor - so the record this test reads back is one the app
// would genuinely produce, not a hand-built approximation.
describe("readRecord - reads a Ruleset tag naming deviating flags (story 00000027, Step 6)", () => {
  function diagonalGameState(
    defender: PieceTypeId,
    configuration: RuleConfiguration,
    blockedFlank: boolean,
  ): InitialGameState {
    const board: Record<
      string,
      { side: "white" | "black"; pieceType: PieceTypeId }
    > = {
      D5: { side: "white", pieceType: "champion" },
      E6: { side: "black", pieceType: defender },
      A1: { side: "white", pieceType: "flag" },
    };
    if (defender !== "flag") {
      board.L12 = { side: "black", pieceType: "flag" };
    }
    if (blockedFlank) {
      // E5 (one of D5->E6's two flanks) blocked; D6, the other flank, stays
      // open - exactly enough for `open_path` to still permit the attack.
      board.E5 = { side: "black", pieceType: "militia" };
    }
    return { ruleset: renderRulesetTag(configuration), configuration, board };
  }

  function playedRecordText(initial: InitialGameState): string {
    const state = startPlay(initial);
    const { state: finished } = applyMove(
      state,
      { column: "D", row: 5 },
      { column: "E", row: 6 },
    );
    return renderGameRecord(finished);
  }

  it("DIAGONAL_ATTACKABLE=all alone: a diagonal Flag capture round-trips and the deviation is reported", () => {
    const configuration = configureRules(EDITIONS["2-0:BATTLE"], {
      DIAGONAL_ATTACKABLE: "all",
    });
    const initial = diagonalGameState("flag", configuration, false);
    const text = playedRecordText(initial);
    expect(text).toContain('[Ruleset "2-0:BATTLE DIAGONAL_ATTACKABLE=all"]');

    const result = readRecord(text);
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }
    expect(deviatingFlags(result.configuration)).toEqual([
      "DIAGONAL_ATTACKABLE",
    ]);
    expect(result.configuration.flags.DIAGONAL_ATTACKABLE).toBe("all");
    expect(result.record.tags.result).toBe("1-0");
    expect(result.record.tags.resultReason).toBe("Flag Captured");
    expect(result.record.positions).toHaveLength(2);
    expect(result.record.positions[1].E6).toEqual({
      side: "white",
      pieceType: "champion",
    });
  });

  it("DIAGONAL_ATTACK_PATH=open_path alone: an attack legal only because one flank is open round-trips and the deviation is reported", () => {
    const configuration = configureRules(EDITIONS["2-0:BATTLE"], {
      DIAGONAL_ATTACK_PATH: "open_path",
    });
    const initial = diagonalGameState("militia", configuration, true);
    const text = playedRecordText(initial);
    expect(text).toContain(
      '[Ruleset "2-0:BATTLE DIAGONAL_ATTACK_PATH=open_path"]',
    );

    const result = readRecord(text);
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }
    expect(deviatingFlags(result.configuration)).toEqual([
      "DIAGONAL_ATTACK_PATH",
    ]);
    expect(result.configuration.flags.DIAGONAL_ATTACK_PATH).toBe("open_path");
    expect(result.record.positions).toHaveLength(2);
    expect(result.record.positions[1].E6).toEqual({
      side: "white",
      pieceType: "champion",
    });
  });

  it("both flags deviating: a diagonal Flag capture that also needed an open flank round-trips and both deviations are reported, alphabetically", () => {
    const configuration = configureRules(EDITIONS["2-0:BATTLE"], {
      DIAGONAL_ATTACKABLE: "all",
      DIAGONAL_ATTACK_PATH: "open_path",
    });
    const initial = diagonalGameState("flag", configuration, true);
    const text = playedRecordText(initial);
    expect(text).toContain(
      '[Ruleset "2-0:BATTLE DIAGONAL_ATTACKABLE=all DIAGONAL_ATTACK_PATH=open_path"]',
    );

    const result = readRecord(text);
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }
    expect(deviatingFlags(result.configuration)).toEqual([
      "DIAGONAL_ATTACKABLE",
      "DIAGONAL_ATTACK_PATH",
    ]);
    expect(result.record.tags.resultReason).toBe("Flag Captured");
  });

  it("canonicalizes a stamp naming a flag at its resolved value: reads as the standard configuration, with no deviation", () => {
    const text = [
      '[Ruleset "2-0:BATTLE DIAGONAL_ATTACKABLE=movable_only"]',
      POSITION_BLOCK,
    ].join("\n\n");

    const result = readRecord(text);
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }
    expect(result.configuration).toEqual(STANDARD_BATTLE_CONFIGURATION);
    expect(deviatingFlags(result.configuration)).toEqual([]);
  });

  it("accepts flag tokens out of order and separated by extra whitespace", () => {
    const skirmish = EDITIONS["2-1:SKIRMISH"];
    const minimalState: InitialGameState = {
      ruleset: skirmish.id,
      configuration: configureRules(skirmish),
      board: { A1: { side: "white", pieceType: "flag" } },
    };
    const skirmishBlock = renderPositionBlock(minimalState);
    const text = [
      '[Ruleset "2-1:SKIRMISH   DIAGONAL_ATTACK_PATH=open_path   DIAGONAL_ATTACKABLE=all"]',
      skirmishBlock,
    ].join("\n\n");

    const result = readRecord(text);
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }
    expect(deviatingFlags(result.configuration)).toEqual([
      "DIAGONAL_ATTACKABLE",
      "DIAGONAL_ATTACK_PATH",
    ]);
  });

  // Story 00000027, Step 10 (correcting a Step 6 defect): none of these four
  // token shapes reject the record any more - `technical-notes.md`
  // guarantees view-only replay "for every record ever written... no rules
  // knowledge required", and only the edition id itself may still refuse a
  // file. Each case still replays end to end and carries the offending
  // token, verbatim, in `unrecognizedRuleTokens` instead of an error.
  it.each([
    ["a malformed token (no '=')", "DIAGONAL_ATTACKABLE"],
    ["an unknown flag id", "SOMETHING_ELSE=all"],
    ["an unknown value for a known flag", "DIAGONAL_ATTACKABLE=bogus"],
  ] as const)(
    "replays a record carrying %s, naming it as an unrecognized token rather than rejecting the record",
    (_description, badToken) => {
      const text = [`[Ruleset "2-0:BATTLE ${badToken}"]`, POSITION_BLOCK].join(
        "\n\n",
      );

      const result = readRecord(text);
      expect(result.kind).toBe("parsed");
      if (result.kind !== "parsed") {
        return;
      }
      expect(result.unrecognizedRuleTokens).toEqual([badToken]);
      // An unresolved token never affects the configuration: it reads as
      // the standard Battle configuration here, since no other token named
      // a flag this app could resolve.
      expect(deviatingFlags(result.configuration)).toEqual([]);
    },
  );

  it("replays a record naming the same flag id twice, keeping the first token's value and reporting the second as unrecognized", () => {
    const text = [
      '[Ruleset "2-0:BATTLE DIAGONAL_ATTACKABLE=all DIAGONAL_ATTACKABLE=movable_only"]',
      POSITION_BLOCK,
    ].join("\n\n");

    const result = readRecord(text);
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }
    expect(result.configuration.flags.DIAGONAL_ATTACKABLE).toBe("all");
    expect(result.unrecognizedRuleTokens).toEqual([
      "DIAGONAL_ATTACKABLE=movable_only",
    ]);
  });

  it("replays a record mixing one recognized and one unrecognized token, describing the recognized one and naming the other as unrecognized", () => {
    const text = [
      '[Ruleset "2-0:BATTLE DIAGONAL_ATTACKABLE=all DIAGONAL_SOMETHING=on"]',
      POSITION_BLOCK,
    ].join("\n\n");

    const result = readRecord(text);
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }
    expect(deviatingFlags(result.configuration)).toEqual([
      "DIAGONAL_ATTACKABLE",
    ]);
    expect(result.configuration.flags.DIAGONAL_ATTACKABLE).toBe("all");
    expect(result.unrecognizedRuleTokens).toEqual(["DIAGONAL_SOMETHING=on"]);
  });

  it("still rejects an unknown edition id - the one thing in the Ruleset tag that can", () => {
    const text = [
      '[Ruleset "9-9:NOT_A_REAL_EDITION DIAGONAL_ATTACKABLE=all"]',
      POSITION_BLOCK,
    ].join("\n\n");

    expect(readRecord(text)).toEqual({
      kind: "error",
      error: { kind: "unknownRuleset", ruleset: "9-9:NOT_A_REAL_EDITION" },
    });
  });
});

// Story 00000027, Step 6: the three checked-in `doc/samples/` fixtures, one
// per non-standard configuration, each read from disk exactly as a player's
// exported record would be - see `doc/samples/README.md` for what each
// demonstrates and how it was built.
describe("readRecord - the checked-in doc/samples/ diagonal-flag fixtures (story 00000027, Step 6)", () => {
  function readSample(fileName: string): string {
    const samplePath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      `../../doc/samples/${fileName}`,
    );
    return readFileSync(samplePath, "utf8");
  }

  it("2-1-skirmish-diagonal-attackable-all.txt: replays a diagonal Flag capture, reporting only DIAGONAL_ATTACKABLE as deviating", () => {
    const result = readRecord(
      readSample("2-1-skirmish-diagonal-attackable-all.txt"),
    );
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }
    expect(deviatingFlags(result.configuration)).toEqual([
      "DIAGONAL_ATTACKABLE",
    ]);
    expect(result.record.tags.result).toBe("1-0");
    expect(result.record.tags.resultReason).toBe("Flag Captured");
    expect(result.record.positions).toHaveLength(2);
  });

  it("2-1-skirmish-diagonal-attack-path-open.txt: replays a diagonal attack that needed an open flank, reporting only DIAGONAL_ATTACK_PATH as deviating", () => {
    const result = readRecord(
      readSample("2-1-skirmish-diagonal-attack-path-open.txt"),
    );
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }
    expect(deviatingFlags(result.configuration)).toEqual([
      "DIAGONAL_ATTACK_PATH",
    ]);
    expect(result.record.positions).toHaveLength(2);
  });

  it("2-1-skirmish-diagonal-both-flags.txt: replays a diagonal Flag capture that needed an open flank, reporting both flags as deviating", () => {
    const result = readRecord(
      readSample("2-1-skirmish-diagonal-both-flags.txt"),
    );
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") {
      return;
    }
    expect(deviatingFlags(result.configuration)).toEqual([
      "DIAGONAL_ATTACKABLE",
      "DIAGONAL_ATTACK_PATH",
    ]);
    expect(result.record.tags.result).toBe("1-0");
    expect(result.record.tags.resultReason).toBe("Flag Captured");
    expect(result.record.positions).toHaveLength(2);
  });
});

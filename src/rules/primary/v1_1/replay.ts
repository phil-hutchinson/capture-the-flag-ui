// The replayer for ruleset PRIMARY:1.1 - the import dry run.
//
// Given a parsed record (`recordFile.ts`), replays every recorded move
// against the starting board and produces the whole game as materialized
// positions: the opening board plus one `BoardState` after each move
// (`moves.length + 1` positions in total). This is what makes "rejected at
// import, not part-loaded" possible - `readRecord.ts` calls this after
// `parseRecordFile` succeeds, so reading a record is parse-then-replay:
// either every move can be carried out, or the whole file is rejected,
// naming the move that could not be.
//
// Replay semantics (stated once, applied blindly - no rules, no legality, no
// combat resolution, no game-end detection). For a move `S[x]-D[x]` by the
// side whose turn it is:
//   1. Remove the piece on `D` if `D` is marked `x`.
//   2. If `S` is marked `x`, remove the piece on `S` (it does not move).
//      Otherwise move the piece from `S` to `D`.
// A Sapper taking a Tower and a piece taking the Flag are ordinary `S-Dx`
// moves - there is no special casing for either, and nothing else (ranks,
// reachability, support, legality) is ever consulted.
//
// The only checks made here are internal consistency, never rules:
//   - `S` must hold a piece, and it must belong to the side whose turn it is.
//   - A move is marked if and only if its destination is occupied, judged
//     against the board *before* the move: an occupied destination with no
//     `x` at all is a piece landing on top of one the record does not
//     remove (rejected); an empty destination marked with an `x` is a
//     phantom result - `S-Dx` claims a capture that wasn't there, `Sx-D`
//     sacrifices the attacker against nothing (both rejected).
// Terrain and army composition are never checked here - see
// `gameState.ts`'s `parsePositionBlock` (terrain, on the starting position
// only) and `recordFile.ts` (army composition is never checked at all).

import { squareKey, type Side, type Square } from "./board.ts";
import type { BoardState, PlacedPiece } from "./gameState.ts";
import type { ParsedRecord, RecordedPly } from "./recordFile.ts";

/**
 * Everything that can go wrong replaying an already-parsed record: a move
 * whose source square holds no piece at all (`emptySource`); a move whose
 * source square holds a piece belonging to the other side (`wrongSide`); a
 * move onto an occupied destination carrying no `x` mark at all
 * (`unmarkedCapture` - a piece landing on top of one the record does not
 * remove); a move onto an *empty* destination that nonetheless marks the
 * destination `x` (`phantomCapture` - a capture of nothing); or a move onto
 * an empty destination that marks the source `x` (`phantomSacrifice` - the
 * attacker sacrificed against nothing). Every kind carries the offending
 * ply's number, round, side and token, plus the square that was the
 * problem, so `reviewText.ts` can name exactly what went wrong.
 */
export type ReplayError =
  | {
      readonly kind: "emptySource";
      readonly ply: number;
      readonly round: number;
      readonly side: Side;
      readonly token: string;
      readonly square: Square;
    }
  | {
      readonly kind: "wrongSide";
      readonly ply: number;
      readonly round: number;
      readonly side: Side;
      readonly token: string;
      readonly square: Square;
    }
  | {
      readonly kind: "unmarkedCapture";
      readonly ply: number;
      readonly round: number;
      readonly side: Side;
      readonly token: string;
      readonly square: Square;
    }
  | {
      readonly kind: "phantomCapture";
      readonly ply: number;
      readonly round: number;
      readonly side: Side;
      readonly token: string;
      readonly square: Square;
    }
  | {
      readonly kind: "phantomSacrifice";
      readonly ply: number;
      readonly round: number;
      readonly side: Side;
      readonly token: string;
      readonly square: Square;
    };

/**
 * One recorded move, replayed: everything `recordFile.ts`'s `RecordedPly`
 * carries, plus the board that resulted from applying it. This is the same
 * board as `ReplayedRecord.positions[ply]` - repeated here so a caller
 * working move-by-move (e.g. the move list) does not need to track an index
 * alongside it.
 */
export interface ReplayedPly extends RecordedPly {
  readonly boardAfter: BoardState;
}

/**
 * A fully replayed recorded game: the header tags carried through unchanged,
 * every position the game ever occupied (`positions[0]` is the opening
 * position; `positions[i]` is the position after `moves[i - 1]` - so
 * `positions.length === moves.length + 1`), and the moves themselves,
 * replayed. There is no partial result - either every move replayed, or
 * `replayRecord` returned an error instead of this.
 */
export interface ReplayedRecord {
  readonly tags: ParsedRecord["tags"];
  readonly positions: readonly BoardState[];
  readonly moves: readonly ReplayedPly[];
}

/** The result of replaying a parsed record: the whole replayed game, or the first move that could not be carried out. Never throws. */
export type ReplayResult =
  | { readonly kind: "replayed"; readonly record: ReplayedRecord }
  | { readonly kind: "error"; readonly error: ReplayError };

/** Applies one already-validated move to `board`, returning the resulting board. Pure - `board` is never mutated. */
function applyMove(
  board: BoardState,
  move: RecordedPly["move"],
  moving: PlacedPiece,
): BoardState {
  const fromKey = squareKey(move.from);
  const toKey = squareKey(move.to);
  const next: Record<string, PlacedPiece> = { ...board };

  if (move.toRemoved) {
    delete next[toKey];
  }
  delete next[fromKey];
  if (!move.fromRemoved) {
    next[toKey] = moving;
  }

  return next;
}

/**
 * Replays every move in `record` against its starting board, applying
 * exactly the semantics and internal-consistency checks stated at the top of
 * this module - nothing else is consulted. Returns the whole replayed game,
 * or the first move that could not be carried out (there is no partial
 * result). Never throws.
 */
export function replayRecord(record: ParsedRecord): ReplayResult {
  const positions: BoardState[] = [record.startingBoard];
  const moves: ReplayedPly[] = [];
  let board = record.startingBoard;

  for (const ply of record.moves) {
    const { move } = ply;
    const fromKey = squareKey(move.from);
    const toKey = squareKey(move.to);
    const moving = board[fromKey];
    const base = {
      ply: ply.ply,
      round: ply.round,
      side: ply.side,
      token: ply.token,
    };

    if (moving === undefined) {
      return {
        kind: "error",
        error: { kind: "emptySource", ...base, square: move.from },
      };
    }
    if (moving.side !== ply.side) {
      return {
        kind: "error",
        error: { kind: "wrongSide", ...base, square: move.from },
      };
    }

    const destinationOccupied = board[toKey] !== undefined;
    const marked = move.fromRemoved || move.toRemoved;

    if (destinationOccupied && !marked) {
      return {
        kind: "error",
        error: { kind: "unmarkedCapture", ...base, square: move.to },
      };
    }
    if (!destinationOccupied && move.toRemoved) {
      return {
        kind: "error",
        error: { kind: "phantomCapture", ...base, square: move.to },
      };
    }
    if (!destinationOccupied && move.fromRemoved) {
      return {
        kind: "error",
        error: { kind: "phantomSacrifice", ...base, square: move.from },
      };
    }

    board = applyMove(board, move, moving);
    positions.push(board);
    moves.push({ ...ply, boardAfter: board });
  }

  return {
    kind: "replayed",
    record: { tags: record.tags, positions, moves },
  };
}

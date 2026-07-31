// The record-file parser for ruleset PRIMARY:1.1 (rules.md §4.4 and
// `doc/ruleset/technical-notes.md`'s "Record file format" in the companion
// capture-the-flag repository - the single source of truth).
//
// A record file is three sections separated by one or more blank lines:
//
//   1. Header tags   - PGN syntax `[Name "value"]`, one per line.
//   2. Position block - the record's *starting* board (see gameState.ts's
//      `parsePositionBlock`, this module's neighbor).
//   3. Move sequence  - rounds numbered from 1, each `N. WhiteMove BlackMove`,
//      wrapped freely (whitespace-insensitive).
//
// This module turns that text into a `ParsedRecord` - the header tags carried
// through as raw strings, the starting `BoardState`, and the ordered list of
// moves - or a structured `RecordFileError`. It applies only the record
// format's own internal consistency (are there 12 rows? is every tag it uses
// present at most once? does every move token parse? do round numbers run in
// order?) - it does not touch the board at all: whether a move can actually
// be carried out on the position it produces is replay.ts's job (Step 4), not
// this one. No player-facing text is produced here (see reviewText.ts).
//
// This is version-specific (the position block's piece letters and the move
// notation belong to ruleset PRIMARY:1.1), so it lives beside the writer it
// mirrors (`renderGameRecord` / `renderPositionBlock`, play.ts / gameState.ts).
// `src/rules/readRecord.ts` is the version-dispatch entry point that decides
// whether a file's `Ruleset` tag routes here at all.

import type { Side } from "./board.ts";
import {
  parsePositionBlock,
  type BoardState,
  type PositionBlockError,
} from "./gameState.ts";
import { parseMoveToken, type RecordedMove } from "./notation.ts";

/**
 * The header tags this reader cares about, carried through as raw strings for
 * the UI layer (`reviewText.ts`) to interpret - this module does not judge
 * whether `result` or `resultReason` are recognized values, only that they
 * are present at most once. Unknown and PGN roster tags (`Event`, `Site`,
 * `White`, ...) are accepted and silently dropped.
 */
export interface RecordFileTags {
  readonly ruleset: string;
  readonly result?: string;
  readonly resultReason?: string;
}

/**
 * One recorded move, in the position it occupies in the game: its overall
 * 1-based ply number, the 1-based round it belongs to, which side made it
 * (White always moves first in each round), the move's original token text
 * (kept for the move list and for wording error/UI messages in the record's
 * own notation), and the move it parses to.
 */
export interface RecordedPly {
  readonly ply: number;
  readonly round: number;
  readonly side: Side;
  readonly token: string;
  readonly move: RecordedMove;
}

/** A fully parsed record file: its tags, its starting board, and its moves in order. */
export interface ParsedRecord {
  readonly tags: RecordFileTags;
  readonly startingBoard: BoardState;
  readonly moves: readonly RecordedPly[];
}

/**
 * Everything that can go wrong reading a record file's structure (as opposed
 * to replaying it - see `replay.ts`). `notARecord` covers both "this text has
 * no recognizable header at all" (e.g. an arbitrary file was chosen) and "the
 * header parses but there is no position block" - either way, this is not a
 * record this app can read a game out of. A move-specific error carries
 * everything `reviewText.ts` needs to name the move: its ply and round
 * number, its side (by color, via `reviewText.ts`), and its original token.
 */
export type RecordFileError =
  | { readonly kind: "notARecord" }
  | { readonly kind: "missingRuleset" }
  | {
      readonly kind: "duplicateTag";
      readonly tag: "Ruleset" | "Result" | "ResultReason";
    }
  | { readonly kind: "positionBlock"; readonly error: PositionBlockError }
  | { readonly kind: "midGameRecord"; readonly round: number }
  | {
      readonly kind: "malformedRound";
      readonly token: string;
    }
  | {
      readonly kind: "roundOutOfOrder";
      readonly expected: number;
      readonly found: number;
    }
  | { readonly kind: "emptyRound"; readonly round: number }
  | { readonly kind: "tooManyMovesInRound"; readonly round: number }
  | { readonly kind: "incompleteRound"; readonly round: number }
  | {
      readonly kind: "plainNotation";
      readonly ply: number;
      readonly round: number;
      readonly side: Side;
      readonly token: string;
    }
  | {
      readonly kind: "malformedMove";
      readonly ply: number;
      readonly round: number;
      readonly side: Side;
      readonly token: string;
    };

/** The result of parsing a record file: a `ParsedRecord`, or a structured error. Never throws. */
export type RecordFileResult =
  | { readonly kind: "parsed"; readonly record: ParsedRecord }
  | { readonly kind: "error"; readonly error: RecordFileError };

/** One header tag line: `[Name "value"]`, PGN-escaped (`\\`, `\"`) inside the value. */
const TAG_LINE = /^\[([A-Za-z][A-Za-z0-9]*)\s+"((?:[^"\\]|\\.)*)"\]$/;

/** Decodes PGN escaping (`\\` -> `\`, `\"` -> `"`) inside a tag value already matched by `TAG_LINE`. */
function unescapeTagValue(raw: string): string {
  return raw.replace(/\\(.)/g, "$1");
}

/** Splits file text into blank-line-separated chunks, each a joined block of consecutive non-blank lines. */
function splitIntoChunks(text: string): string[][] {
  const lines = text.split(/\r\n|\r|\n/).map((line) => line.trim());
  const chunks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.length === 0) {
      if (current.length > 0) {
        chunks.push(current);
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

/** The result of parsing the header chunk: its tags, or the reason the whole file is unreadable. */
type HeaderResult =
  | { readonly kind: "parsed"; readonly tags: RecordFileTags }
  | { readonly kind: "error"; readonly error: RecordFileError };

/** Parses the header chunk's lines into `RecordFileTags`, per the rules stated at the top of this module. */
function parseHeader(lines: readonly string[]): HeaderResult {
  let ruleset: string | undefined;
  let result: string | undefined;
  let resultReason: string | undefined;

  for (const line of lines) {
    const match = TAG_LINE.exec(line);
    if (match === null) {
      // A line in the header chunk that isn't a tag at all means this isn't
      // a readable record header - most likely an arbitrary file was chosen.
      return { kind: "error", error: { kind: "notARecord" } };
    }
    const [, name, rawValue] = match;
    const value = unescapeTagValue(rawValue);

    if (name === "Ruleset") {
      if (ruleset !== undefined) {
        return {
          kind: "error",
          error: { kind: "duplicateTag", tag: "Ruleset" },
        };
      }
      ruleset = value;
    } else if (name === "Result") {
      if (result !== undefined) {
        return {
          kind: "error",
          error: { kind: "duplicateTag", tag: "Result" },
        };
      }
      result = value;
    } else if (name === "ResultReason") {
      if (resultReason !== undefined) {
        return {
          kind: "error",
          error: { kind: "duplicateTag", tag: "ResultReason" },
        };
      }
      resultReason = value;
    }
    // Every other tag (roster tags, and anything unknown) is accepted and ignored.
  }

  if (ruleset === undefined) {
    return { kind: "error", error: { kind: "missingRuleset" } };
  }

  return { kind: "parsed", tags: { ruleset, result, resultReason } };
}

/** A round marker token, e.g. `"12."` or the reserved mid-game form `"12..."`. */
const ROUND_MARKER = /^(\d+)(\.\.\.|\.)$/;

/** The result of parsing the move-sequence chunk into ordered `RecordedPly`s, or the first error found. */
type MovesResult =
  | { readonly kind: "parsed"; readonly moves: RecordedPly[] }
  | { readonly kind: "error"; readonly error: RecordFileError };

/**
 * Parses the move-sequence chunk (already reduced to whitespace-separated
 * tokens by the caller) into ordered `RecordedPly`s. Round numbers must
 * ascend from 1 with exactly two moves per round, except possibly the last
 * round, which may carry only White's move.
 */
function parseMoves(tokens: readonly string[]): MovesResult {
  const moves: RecordedPly[] = [];
  let expectedRound = 1;
  let ply = 1;
  let index = 0;

  while (index < tokens.length) {
    const marker = ROUND_MARKER.exec(tokens[index]);
    if (marker === null) {
      return {
        kind: "error",
        error: { kind: "malformedRound", token: tokens[index] },
      };
    }
    const [, roundDigits, dots] = marker;
    const round = Number(roundDigits);
    index += 1;

    if (dots === "...") {
      return { kind: "error", error: { kind: "midGameRecord", round } };
    }
    if (round !== expectedRound) {
      return {
        kind: "error",
        error: {
          kind: "roundOutOfOrder",
          expected: expectedRound,
          found: round,
        },
      };
    }

    const roundTokens: string[] = [];
    while (index < tokens.length && ROUND_MARKER.exec(tokens[index]) === null) {
      roundTokens.push(tokens[index]);
      index += 1;
    }

    if (roundTokens.length === 0) {
      return { kind: "error", error: { kind: "emptyRound", round } };
    }
    if (roundTokens.length > 2) {
      return { kind: "error", error: { kind: "tooManyMovesInRound", round } };
    }
    // A one-move round is only valid as the very last round of the file (a
    // game that ended on White's move) - a one-move round anywhere else
    // silently drops the missing side's move and renumbers every ply after
    // it, which is exactly the kind of record this app cannot make sense of.
    if (roundTokens.length === 1 && index < tokens.length) {
      return { kind: "error", error: { kind: "incompleteRound", round } };
    }

    for (const [sideIndex, token] of roundTokens.entries()) {
      const side: Side = sideIndex === 0 ? "white" : "black";
      const parsedToken = parseMoveToken(token);
      if (parsedToken.kind === "plainNotation") {
        return {
          kind: "error",
          error: { kind: "plainNotation", ply, round, side, token },
        };
      }
      if (parsedToken.kind === "malformed") {
        return {
          kind: "error",
          error: { kind: "malformedMove", ply, round, side, token },
        };
      }
      moves.push({ ply, round, side, token, move: parsedToken.move });
      ply += 1;
    }

    expectedRound = round + 1;
  }

  return { kind: "parsed", moves };
}

/**
 * Parses a record file's text into a `ParsedRecord`, or a structured
 * `RecordFileError`. Tolerates LF or CRLF line endings, leading/trailing
 * blank lines, any number of blank lines between sections, trailing spaces on
 * any line, and a freely wrapped move sequence. Never throws.
 */
export function parseRecordFile(text: string): RecordFileResult {
  const chunks = splitIntoChunks(text);

  if (chunks.length < 2) {
    return { kind: "error", error: { kind: "notARecord" } };
  }

  const headerResult = parseHeader(chunks[0]);
  if (headerResult.kind === "error") {
    return { kind: "error", error: headerResult.error };
  }

  const positionResult = parsePositionBlock(chunks[1].join("\n"));
  if (positionResult.kind === "error") {
    return {
      kind: "error",
      error: { kind: "positionBlock", error: positionResult.error },
    };
  }

  // A record with no moves at all is valid (a game recorded before any move
  // was made) - the review then shows only the opening position.
  const moveTokens = chunks
    .slice(2)
    .flat()
    .flatMap((line) => line.split(/\s+/))
    .filter((token) => token.length > 0);

  const movesResult = parseMoves(moveTokens);
  if (movesResult.kind === "error") {
    return { kind: "error", error: movesResult.error };
  }

  return {
    kind: "parsed",
    record: {
      tags: headerResult.tags,
      startingBoard: positionResult.board,
      moves: movesResult.moves,
    },
  };
}

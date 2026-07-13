// Move notation for the record file format, ruleset PRIMARY:1.1
// (rules.md §4.4, companion capture-the-flag repository - the single source
// of truth). Squares are always in the absolute White frame (board.ts):
// column A-L, row 1-12, uppercase.
//
// Two forms exist in the format; this module only ever *produces* the
// extended (result-marking) form, and *parses* both, so that a plain-form
// token can be told apart from every other kind of malformed token and
// rejected with its own message (story policy - a record we cannot replay
// without applying the rules is not reviewable):
//
//   Plain:    `A4A5`    - source immediately followed by destination.
//   Extended: `S[x]-D[x]` - always a `-` between the squares, with an `x`
//             immediately after a square meaning "the piece that stood there
//             did not survive this move":
//               `A4-A5`   - a move with no attack.
//               `A4-A5x`  - attacker wins; the defender is removed, the
//                           attacker advances.
//               `A4x-A5`  - attacker loses (complete sacrifice); the
//                           defender stands.
//               `A4x-A5x` - mutual loss; both are removed.
//
// This is the single home of the grammar - both directions (parse and
// render) live here - so the reader (recordFile.ts, Step 3) and the future
// extended-form writer (currently `renderGameRecord` in play.ts still emits
// the plain form) cannot drift apart. This module is pure notation: it knows
// nothing about boards, pieces or replay legality - see replay.ts (Step 4)
// for what a parsed move means once applied.

import { squareKey, type Square } from "./board.ts";

/**
 * A single move as recorded in the extended (result-marking) notation: which
 * square the piece moved from, which square it moved to, and whether the
 * piece that stood on each square did not survive the move. `fromRemoved`
 * true means the attacker was lost (a complete sacrifice - the piece did not
 * move); `toRemoved` true means the defender was lost (the attacker
 * advanced). Both false is a quiet move; both true is a mutual loss. This
 * says nothing about whether the move is legal or even internally
 * consistent with a given board - see replay.ts.
 */
export interface RecordedMove {
  readonly from: Square;
  readonly to: Square;
  readonly fromRemoved: boolean;
  readonly toRemoved: boolean;
}

/**
 * The result of parsing one move token: either a successfully parsed
 * `RecordedMove`, or one of two distinct rejections - `"plainNotation"` for a
 * token in the plain form (`A4A5`), which the app deliberately does not
 * support (a record we cannot replay without applying the rules is not
 * reviewable), and `"malformed"` for anything else that is not a valid move
 * token at all. Callers that need a player-facing message (reviewText.ts)
 * tell these apart to word the rejection differently. Never throws.
 */
export type ParsedMoveToken =
  | { readonly kind: "parsed"; readonly move: RecordedMove }
  | { readonly kind: "plainNotation"; readonly token: string }
  | { readonly kind: "malformed"; readonly token: string };

/** One square token: a single column letter A-L followed by row 1-12, no leading zero. */
const SQUARE_PATTERN = "[A-L](?:1[0-2]|[1-9])";

/** A full square token, anchored - used to parse the pieces matched by the move patterns. */
const SQUARE_ONLY = new RegExp(`^(${SQUARE_PATTERN})$`);

/** The extended (result-marking) form: `S[x]-D[x]`. */
const EXTENDED_PATTERN = new RegExp(
  `^(${SQUARE_PATTERN})(x)?-(${SQUARE_PATTERN})(x)?$`,
);

/** The plain form: `SD`, with no separator - recognized only to reject it distinctly. */
const PLAIN_PATTERN = new RegExp(`^(${SQUARE_PATTERN})(${SQUARE_PATTERN})$`);

/** Parses a square token (e.g. `"L12"`) already known to match `SQUARE_PATTERN`. */
function toSquare(token: string): Square {
  const match = SQUARE_ONLY.exec(token);
  if (match === null) {
    throw new Error(`Not a valid square token: "${token}".`);
  }
  const column = token[0] as Square["column"];
  const row = Number(token.slice(1)) as Square["row"];
  return { column, row };
}

/**
 * Parses one move token from a record file's move sequence. Accepts the four
 * extended shapes (`S-D`, `S-Dx`, `Sx-D`, `Sx-Dx`); rejects a plain-form
 * token (`A4A5`) with the distinct `"plainNotation"` kind; rejects anything
 * else as `"malformed"`. Never throws.
 */
export function parseMoveToken(token: string): ParsedMoveToken {
  const extended = EXTENDED_PATTERN.exec(token);
  if (extended !== null) {
    const [, fromToken, fromX, toToken, toX] = extended;
    return {
      kind: "parsed",
      move: {
        from: toSquare(fromToken),
        to: toSquare(toToken),
        fromRemoved: fromX !== undefined,
        toRemoved: toX !== undefined,
      },
    };
  }

  if (PLAIN_PATTERN.test(token)) {
    return { kind: "plainNotation", token };
  }

  return { kind: "malformed", token };
}

/**
 * Renders a `RecordedMove` back to its extended-form token, e.g.
 * `{ from: A4, to: A5, fromRemoved: false, toRemoved: true }` -> `"A4-A5x"`.
 * The inverse of `parseMoveToken` for every move it can produce. Nothing in
 * the app calls this yet (the current writer, `renderGameRecord` in
 * play.ts, still emits the plain form) - it exists so a future extended-form
 * writer shares this module rather than forking the grammar.
 */
export function renderMoveToken(move: RecordedMove): string {
  const from = squareKey(move.from) + (move.fromRemoved ? "x" : "");
  const to = squareKey(move.to) + (move.toRemoved ? "x" : "");
  return `${from}-${to}`;
}

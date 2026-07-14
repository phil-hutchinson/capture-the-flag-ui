// Player-facing wording for the reviewer (story 00000014, Step 6).
//
// The rules layer (`src/rules/readRecord.ts` and everything it delegates to -
// `recordFile.ts`, `replay.ts`, `gameState.ts`'s `parsePositionBlock`) returns
// only *structured* errors and result data - stable identifiers, squares,
// numbers - never a sentence, exactly like `outcome.ts`'s `GameEndReason`.
// This module is the one place those structures become the sentences a
// player reads, per the story's fixed policy: "rejection is a player-facing
// moment, not a stack trace" - the message says what is wrong and, where it
// is a specific move, which one (its number, round, side and token).
//
// Every switch below ends in a `default: return kind satisfies never;`
// branch (the pattern `playAnnouncement.ts`'s `reasonLabel` already uses).
// That is what "the compiler enforces exhaustiveness" means here: adding a
// new error kind to any of the rules-layer unions this module renders makes
// every switch over it fail to compile until this module is taught the new
// kind's wording - a future error kind cannot silently ship without a
// message.
//
// Two jobs, per the plan:
//   1. `describeRejection` - one sentence per `ReadRecordError` (and the
//      errors it wraps: `RecordFileError`, `PositionBlockError`,
//      `ReplayError`).
//   2. `describeRecordedResult` - the sentence shown at the end of a review,
//      built from the file's `Result`/`ResultReason` tags and framed as the
//      record's claim, not a computed outcome. It reuses `describeResult`
//      (`playAnnouncement.ts`) for any recognized reason, so a reviewed
//      result reads word-for-word like a played one.
//
// Story 00000014, Step 14 adds a third job: `describeMove`, the sentence
// naming one recorded move for the review's screen-reader announcement (color,
// piece, from/to, and what the record says was removed) - reusing
// `sideColorName` and `PIECE_CATALOG` display names, and echoing
// `playAnnouncement.ts`'s "attacked .../falls/advances/holds" idiom (Phase 2's
// own established combat wording) so a reviewed move reads in the same voice
// as a played one. `reviewSession.ts`'s `describeStepAnnouncement` combines
// this with `describePosition` and `describeRecordedResult` into the single
// sentence pushed into the board's one polite live region on every step or
// jump.
//
// Always "move", never "ply"; always Red/Blue via `sideColorName`, never
// White/Black.

import type { Side, Square } from "../rules/primary/v1_1/board.ts";
import { otherSide, squareKey } from "../rules/primary/v1_1/board.ts";
import type {
  RecordFileError,
  RecordFileTags,
} from "../rules/primary/v1_1/recordFile.ts";
import type { PositionBlockError } from "../rules/primary/v1_1/gameState.ts";
import type { ReplayError } from "../rules/primary/v1_1/replay.ts";
import type {
  GameEndReason,
  GameOutcome,
} from "../rules/primary/v1_1/outcome.ts";
import {
  PIECE_CATALOG,
  type PieceTypeId,
} from "../rules/primary/v1_1/pieces.ts";
import type { ReadRecordError } from "../rules/readRecord.ts";
import { describeResult } from "../board/playAnnouncement.ts";
import { sideColorName } from "../board/sideNames.ts";

/** "Move {ply} (round {round}, {color})" - the shared prefix naming a specific recorded move. Lower-cased color, matching prose like "round 6, blue". */
function moveLabel(ply: number, round: number, side: Side): string {
  return `Move ${ply} (round ${round}, ${sideColorName(side).toLowerCase()})`;
}

/** Player-facing wording for one `PositionBlockError` - the record's starting position isn't a valid board. */
function describePositionBlockError(error: PositionBlockError): string {
  switch (error.kind) {
    case "wrongRowCount":
      return `This file's starting position isn't a full 12x12 board (it has ${error.rowCount} row${error.rowCount === 1 ? "" : "s"} instead of 12), so it can't be reviewed.`;
    case "wrongCellCount":
      return `This file's starting position has a row (row ${error.row}) that isn't 12 squares wide, so it can't be reviewed.`;
    case "unrecognizedCell":
      return `This file's starting position has something at ${squareKey(error.square)} ("${error.cell}") that isn't a piece, an empty square, or a lake, so it can't be reviewed.`;
    case "unknownPieceSymbol":
      return `This file's starting position uses a piece symbol this app doesn't recognize ("${error.symbol}", at ${squareKey(error.square)}), so it can't be reviewed.`;
    case "lakeCellOffLake":
      return `This file's starting position marks ${squareKey(error.square)} as a lake, but that square isn't one, so it can't be reviewed.`;
    case "lakeSquareNotXxx":
      return `This file's starting position doesn't mark the lake at ${squareKey(error.square)} correctly, so it can't be reviewed.`;
    default:
      return error satisfies never;
  }
}

/** Player-facing wording for one `RecordFileError` - a problem with the record's structure (before any replay is attempted). */
function describeRecordFileError(error: RecordFileError): string {
  switch (error.kind) {
    case "notARecord":
      return "This file isn't a game record.";
    case "missingRuleset":
      return "This file doesn't say what ruleset it was recorded under, so it can't be reviewed.";
    case "duplicateTag":
      return `This file lists the ${error.tag} tag more than once, so it can't be reviewed.`;
    case "positionBlock":
      return describePositionBlockError(error.error);
    case "midGameRecord":
      return `This file's move list starts partway through a game, at round ${error.round}, instead of from the first move, so it can't be reviewed.`;
    case "malformedRound":
      return `This file's move list has something that isn't a valid move or round number ("${error.token}"), so it can't be reviewed.`;
    case "roundOutOfOrder":
      return `This file's rounds are out of order (expected round ${error.expected}, found round ${error.found}), so it can't be reviewed.`;
    case "emptyRound":
      return `This file's round ${error.round} has no moves in it, so it can't be reviewed.`;
    case "tooManyMovesInRound":
      return `This file's round ${error.round} has more than two moves in it, so it can't be reviewed.`;
    case "plainNotation":
      return `${moveLabel(error.ply, error.round, error.side)} — ${error.token} uses the short move notation, which doesn't record what happened to each piece, so it can't be reviewed.`;
    case "malformedMove":
      return `${moveLabel(error.ply, error.round, error.side)} — ${error.token} isn't a move this app recognizes, so it can't be reviewed.`;
    default:
      return error satisfies never;
  }
}

/** Player-facing wording for one `ReplayError` - a move that parsed fine but can't actually be carried out on the board it produces. */
function describeReplayError(error: ReplayError): string {
  const label = moveLabel(error.ply, error.round, error.side);
  switch (error.kind) {
    case "emptySource":
      return `${label} — ${error.token} starts from an empty square.`;
    case "wrongSide":
      return `${label} — ${error.token} moves a piece that belongs to the other side.`;
    case "unmarkedCapture":
      return `${label} — ${error.token} lands on a piece the record doesn't say was removed.`;
    case "phantomCapture":
      return `${label} — ${error.token} marks a capture, but the square it lands on is empty.`;
    case "phantomSacrifice":
      return `${label} — ${error.token} sacrifices the piece that moved, but the square it's moving to is empty.`;
    default:
      return error satisfies never;
  }
}

/**
 * A short player-facing description of where the review cursor is in the
 * game: "Opening position" before any move has been made, or "Move {ply} of
 * {totalMoves} — round {round}, {color}" once one has. Used by
 * `reviewSession.ts`'s `describeCurrentPosition` - the one place this
 * wording is assembled, so the status line and (later) the announcement of
 * a step or jump read identically.
 */
export function describePosition(input: {
  readonly totalMoves: number;
  readonly move: {
    readonly ply: number;
    readonly round: number;
    readonly side: Side;
  } | null;
}): string {
  if (input.move === null) {
    return "Opening position";
  }
  const { ply, round, side } = input.move;
  return `Move ${ply} of ${input.totalMoves} — round ${round}, ${sideColorName(side).toLowerCase()}`;
}

/**
 * Structured input for `describeMove` - everything it needs to name one
 * recorded move, gathered by `reviewSession.ts` from the positions either
 * side of it (`mover` is always present - the replayer already proved the
 * source square held a piece; `defender` is the piece type that stood on the
 * destination *before* the move, or `null` for a quiet move onto an empty
 * square, per `replay.ts`'s "marked if and only if the destination is
 * occupied" rule).
 */
export interface MoveAnnouncementInput {
  readonly side: Side;
  readonly mover: PieceTypeId;
  readonly from: Square;
  readonly to: Square;
  readonly fromRemoved: boolean;
  readonly toRemoved: boolean;
  readonly defender: PieceTypeId | null;
}

/**
 * The player-facing sentence naming one recorded move for the review's
 * screen-reader announcement: color, piece, source and destination squares,
 * and - for a move that carries combat marks - what the record says was
 * removed. Echoes `playAnnouncement.ts`'s `describeAttack` idiom ("attacked
 * ... falls/advances/holds") so a reviewed move reads in the same voice as a
 * played one, but always states the source square too (unlike
 * `describeAttack`, which can rely on the piece having *just* been picked up
 * from a visibly selected square - a review can jump straight to any
 * position, so the origin needs to be said explicitly).
 */
export function describeMove(input: MoveAnnouncementInput): string {
  const moverName = `${sideColorName(input.side)} ${PIECE_CATALOG[input.mover].displayName}`;
  const fromName = squareKey(input.from);
  const toName = squareKey(input.to);

  if (input.defender === null) {
    return `${moverName} moved from ${fromName} to ${toName}.`;
  }

  const defenderName = `${sideColorName(otherSide(input.side))} ${PIECE_CATALOG[input.defender].displayName}`;

  if (input.toRemoved && !input.fromRemoved) {
    return `${moverName} attacked ${defenderName} from ${fromName} to ${toName}: ${defenderName} falls, ${moverName} advances.`;
  }
  if (input.fromRemoved && !input.toRemoved) {
    return `${moverName} attacked ${defenderName} from ${fromName} to ${toName} and falls; ${defenderName} holds.`;
  }
  return `${moverName} attacked ${defenderName} from ${fromName} to ${toName}: both fall.`;
}

/**
 * The player-facing rejection sentence for a `ReadRecordError` - what a
 * player can act on: what is wrong and, where it is a specific move, which
 * one (its number, round, side and token). Never "ply"; sides are always
 * named by color.
 */
export function describeRejection(error: ReadRecordError): string {
  switch (error.kind) {
    case "notARecord":
      return "This file isn't a game record.";
    case "unknownRuleset":
      return `This game was recorded under ruleset ${error.ruleset}, which this app doesn't know how to review.`;
    case "recordFile":
      return describeRecordFileError(error.error);
    case "replay":
      return describeReplayError(error.error);
    default:
      return error satisfies never;
  }
}

/** The four PGN `Result` values this app knows what to do with. */
const RESULT_WINNER: Readonly<Record<string, Side | "draw">> = {
  "1-0": "white",
  "0-1": "black",
  "1/2-1/2": "draw",
};

/** The engine's `ResultReason` strings (plus this app's own `Agreement`), matched case-insensitively, mapped onto `outcome.ts`'s stable `GameEndReason` identifiers. */
const RESULT_REASON: Readonly<Record<string, GameEndReason>> = {
  "flag captured": "flagCapture",
  "unbreachable flag": "unbreachableFlag",
  "no legal move": "noLegalMove",
  inactivity: "inactivity",
  "no progress": "noProgress",
  agreement: "agreement",
};

/**
 * The player-facing sentence for what the record's `Result`/`ResultReason`
 * tags claim about how the game ended, framed as the record's claim rather
 * than something this app worked out (e.g. "The record says: Red wins — Flag
 * captured."). Returns `null` when the record makes no claim at all - no
 * `Result` tag, `Result` is `*` (ongoing/unknown), or a `Result` value this
 * app doesn't recognize.
 *
 * A recognized `ResultReason` is mapped to the matching `GameEndReason` and
 * rendered with `describeResult` (`playAnnouncement.ts`), so a reviewed
 * result reads word-for-word like a played one. An unrecognized reason is
 * quoted verbatim rather than dropped; a `Result` with no reason at all is
 * reported with no reason clause.
 */
export function describeRecordedResult(
  tags: Pick<RecordFileTags, "result" | "resultReason">,
): string | null {
  if (tags.result === undefined) {
    return null;
  }

  const winner = RESULT_WINNER[tags.result];
  if (winner === undefined) {
    // `*` (ongoing/unknown) or a value this app doesn't recognize: no claim.
    return null;
  }

  const reason =
    tags.resultReason === undefined
      ? undefined
      : RESULT_REASON[tags.resultReason.toLowerCase()];

  if (reason !== undefined) {
    const outcome: GameOutcome =
      winner === "draw"
        ? { kind: "draw", reason }
        : { kind: "win", winner, reason };
    return `The record says: ${describeResult(outcome)}`;
  }

  if (tags.resultReason !== undefined) {
    // An unrecognized reason is quoted verbatim, not dropped.
    return winner === "draw"
      ? `The record says: The game is a draw — "${tags.resultReason}".`
      : `The record says: ${sideColorName(winner)} wins — "${tags.resultReason}".`;
  }

  return winner === "draw"
    ? "The record says: The game is a draw."
    : `The record says: ${sideColorName(winner)} wins.`;
}

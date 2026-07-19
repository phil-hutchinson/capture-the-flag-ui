// The version-dispatch entry point for reading a recorded game file - the
// only entry point the UI calls (`src/review/ImportScreen.tsx`).
//
// Reading a record is version-sensitive: the position block's piece letters
// and the move notation belong to a specific ruleset version, so the actual
// parsing lives with that version's rule code
// (`src/rules/primary/v1/recordFile.ts` for `PRIMARY:1.1`). This module
// knows only the *set* of ruleset versions this app can read: it looks just
// far enough into the file to find the `Ruleset` tag, and either delegates to
// that version's reader or rejects the file as one this app doesn't know how
// to review. A future ruleset version adds a case here rather than editing an
// existing one.
//
// Reading a record is parse-then-replay (`recordFile.ts` then `replay.ts`):
// this entry point returns either a fully replayed recorded game - every
// position it ever occupied - or a rejection, naming what went wrong. There
// is no partial result: a file that parses but cannot be replayed to the end
// is rejected exactly as if it had failed to parse.

import {
  parseRecordFile,
  type RecordFileError,
} from "./primary/v1/recordFile.ts";
import { RULESET_TAG } from "./primary/v1/gameState.ts";
import {
  replayRecord,
  type ReplayedRecord,
  type ReplayError,
} from "./primary/v1/replay.ts";

/**
 * Everything that can go wrong before a version-specific reader even gets a
 * chance to run: the file has no readable `Ruleset` tag at all (most likely
 * an arbitrary file was chosen - see `recordFile.ts`'s own `notARecord`,
 * which this deliberately mirrors), or it names a ruleset this app does not
 * know how to review. A recognized ruleset's own structural errors are that
 * version's `RecordFileError`; a record whose structure is fine but that
 * cannot be replayed to the end is that version's `ReplayError`.
 */
export type ReadRecordError =
  | { readonly kind: "notARecord" }
  | { readonly kind: "unknownRuleset"; readonly ruleset: string }
  | { readonly kind: "recordFile"; readonly error: RecordFileError }
  | { readonly kind: "replay"; readonly error: ReplayError };

/** The result of reading a record file: a fully replayed recorded game, or a structured rejection. Never throws. */
export type ReadRecordResult =
  | { readonly kind: "parsed"; readonly record: ReplayedRecord }
  | { readonly kind: "error"; readonly error: ReadRecordError };

/**
 * Matches a `[Ruleset "value"]` header line anywhere in the raw file text,
 * tolerating the same PGN escaping the full header parser does. This is
 * deliberately a light-touch scan, not a validation of the header as a whole
 * - it exists only to decide which version's reader to hand the file to; the
 * delegated reader is the one that judges the header's structure.
 */
const RULESET_TAG_LINE = /\[Ruleset\s+"((?:[^"\\]|\\.)*)"\]/;

/** Decodes PGN escaping (`\\` -> `\`, `\"` -> `"`) inside a tag value already matched by `RULESET_TAG_LINE`. */
function unescapeTagValue(raw: string): string {
  return raw.replace(/\\(.)/g, "$1");
}

/**
 * Reads a recorded game file's text, dispatching to the ruleset version it
 * declares and then replaying it in full. Returns a `notARecord` rejection
 * when no `Ruleset` tag can be found at all (the file is not recognizable as
 * a game record - most likely the wrong kind of file was chosen), an
 * `unknownRuleset` rejection naming the ruleset when one is found but this
 * app does not know it, that version's own `recordFile` rejection if the
 * file's structure is unreadable, that version's own `replay` rejection if
 * the file parses but cannot be replayed to the end, or otherwise the fully
 * replayed game - there is no partial result.
 */
export function readRecord(text: string): ReadRecordResult {
  const match = RULESET_TAG_LINE.exec(text);
  if (match === null) {
    return { kind: "error", error: { kind: "notARecord" } };
  }

  const ruleset = unescapeTagValue(match[1]);
  if (ruleset !== RULESET_TAG) {
    return { kind: "error", error: { kind: "unknownRuleset", ruleset } };
  }

  const parseResult = parseRecordFile(text);
  if (parseResult.kind === "error") {
    return {
      kind: "error",
      error: { kind: "recordFile", error: parseResult.error },
    };
  }

  const replayResult = replayRecord(parseResult.record);
  if (replayResult.kind === "error") {
    return {
      kind: "error",
      error: { kind: "replay", error: replayResult.error },
    };
  }

  return { kind: "parsed", record: replayResult.record };
}

// The version-dispatch entry point for reading a recorded game file - the
// only entry point the UI calls (`src/review/ImportScreen.tsx`).
//
// Reading a record is edition-sensitive: the position block's dimensions and
// the piece letters belong to a specific edition's `BoardLayout`, so this
// module looks just far enough into the file to find the `Ruleset` tag,
// splits its value on whitespace, and treats the **first** token as the
// edition id (`2-0:BATTLE`, `2-1:SKIRMISH`, or the superseded
// `2-0:SKIRMISH`, per `technical-notes.md`'s "editions and flags" model) -
// and either resolves that edition and delegates to the (single,
// edition-parametric) major-2 reader (`src/rules/primary/v2/recordFile.ts`)
// or rejects the file as one this app doesn't know how to review. Resolution
// is against `EDITIONS`, which holds every registered edition regardless of
// its `status` (story 00000025) - a record naming the superseded
// `2-0:SKIRMISH` still reviews, even though that edition is no longer
// offered as a game to start. This app plays only major 2, so the old
// `1.2:PRE-RELEASE` tag is not a case here at all any more (story 00000023's
// Step 8, the owner-authorized "replace, don't version-alongside" exception
// - see this story's story.md): such a file falls straight through to the
// same `unknownRuleset` rejection as any other name this app does not
// recognize. A future ruleset version adds a case here rather than editing
// an existing one.
//
// The tag's **remaining** tokens (story 00000027's implementation plan,
// Decision 5) are handed to `configuration.ts`'s `parseRuleFlagTokens`,
// together with the resolved edition, to build the canonical
// `RuleConfiguration` the record was played under - flag vocabulary stays
// inside the major-2 folder (`ruleFlags.ts`/`configuration.ts`) while
// dispatch (splitting the tag, consuming the edition id) stays here.
//
// Story 00000027, Step 10 (correcting a Step 6 defect): `parseRuleFlagTokens`
// never fails, so no flag token can reject a record - only the edition id
// can, per `technical-notes.md`'s view-only-replay guarantee (see
// `configuration.ts`'s header comment). A token that names no known flag id,
// no known value, is malformed, or repeats an already-resolved flag id is
// carried back as an *unrecognized* token, verbatim, alongside the record's
// otherwise fully resolved `RuleConfiguration` - `src/review/reviewText.ts`
// and `src/board/ruleChoices.ts` tell the reviewer, plainly, that this app
// cannot describe what an unrecognized token means, rather than hiding it or
// refusing to review the game at all.
//
// Reading a record is parse-then-replay (`recordFile.ts` then `replay.ts`):
// this entry point returns either a fully replayed recorded game - every
// position it ever occupied - or a rejection, naming what went wrong. There
// is no partial result: a file that parses but cannot be replayed to the end
// is rejected exactly as if it had failed to parse.

import {
  parseRuleFlagTokens,
  type RuleConfiguration,
} from "./primary/v2/configuration.ts";
import { EDITIONS, type EditionId } from "./primary/v2/edition.ts";
import {
  parseRecordFile,
  type RecordFileError,
} from "./primary/v2/recordFile.ts";
import {
  replayRecord,
  type ReplayedRecord,
  type ReplayError,
} from "./primary/v2/replay.ts";

/** True if `ruleset` names one of this app's known editions. */
function isKnownEditionId(ruleset: string): ruleset is EditionId {
  return Object.hasOwn(EDITIONS, ruleset);
}

/**
 * Everything that can go wrong before a version-specific reader even gets a
 * chance to run: the file has no readable `Ruleset` tag at all (most likely
 * an arbitrary file was chosen - see `recordFile.ts`'s own `notARecord`,
 * which this deliberately mirrors), or it names a ruleset this app does not
 * know how to review (`unknownRuleset`, carrying just the edition token - the
 * tag's first whitespace-separated token, per Decision 5). The edition id is
 * the *only* part of the tag that can still reject a record (story 00000027,
 * Step 10) - a `FLAG=value` token after it that this app cannot make sense
 * of is never a rejection; see `readRecord`'s own doc comment and
 * `ParsedRuleFlagTokens.unrecognizedTokens`. A recognized ruleset's own
 * structural errors are that version's `RecordFileError`; a record whose
 * structure is fine but that cannot be replayed to the end is that version's
 * `ReplayError`.
 */
export type ReadRecordError =
  | { readonly kind: "notARecord" }
  | { readonly kind: "unknownRuleset"; readonly ruleset: string }
  | { readonly kind: "recordFile"; readonly error: RecordFileError }
  | { readonly kind: "replay"; readonly error: ReplayError };

/**
 * The result of reading a record file: a fully replayed recorded game
 * together with the resolved `RuleConfiguration` its `Ruleset` tag named
 * (story 00000023's Gate D defect fix - the board a record is *rendered* on
 * must be the record's own edition, never assumed Battle, so this is carried
 * alongside `record` rather than discarded once dispatch is done; story
 * 00000027's Step 3 widens this from a bare `Edition` to the full
 * configuration, and Step 6 teaches this function to read a tag naming
 * deviating flags too - a stamp naming a flag at its resolved value is
 * canonicalized away, per `parseRuleFlagTokens`) and the verbatim text of
 * every `FLAG=value` token in the tag this app could not resolve (Step 10 -
 * always `[]` for a tag this app fully understands, including every tag it
 * has ever written itself), or a structured rejection. Never throws.
 */
export type ReadRecordResult =
  | {
      readonly kind: "parsed";
      readonly record: ReplayedRecord;
      readonly configuration: RuleConfiguration;
      readonly unrecognizedRuleTokens: readonly string[];
    }
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
 * Reads a recorded game file's text, dispatching to the edition its
 * `Ruleset` tag names and then replaying it in full. Returns a `notARecord`
 * rejection when no `Ruleset` tag can be found at all (the file is not
 * recognizable as a game record - most likely the wrong kind of file was
 * chosen), an `unknownRuleset` rejection naming the tag's first
 * whitespace-separated token - the edition id - when it is not one this app
 * knows (which now includes the retired `1.2:PRE-RELEASE` tag, since major-1
 * records are deliberately not reviewable, story 00000023's Step 8), the
 * resolved edition's own `recordFile` rejection if the file's structure is
 * unreadable (including a position block whose size does not match that
 * edition's `BoardLayout`), that edition's own `replay` rejection if the
 * file parses but cannot be replayed to the end, or otherwise the fully
 * replayed game paired with the canonical `RuleConfiguration` it was read as
 * and any `FLAG=value` tokens this app could not resolve - there is no
 * partial result once the edition id itself is recognized (story 00000027,
 * Step 10: a `FLAG=value` token this app cannot make sense of never rejects
 * a record - `configuration.ts`'s `parseRuleFlagTokens` always resolves,
 * carrying anything it cannot understand as an unrecognized token instead).
 * A tag naming a flag at the value it would resolve to anyway reads as the
 * standard configuration, reporting no deviation (canonicalization).
 */
export function readRecord(text: string): ReadRecordResult {
  const match = RULESET_TAG_LINE.exec(text);
  if (match === null) {
    return { kind: "error", error: { kind: "notARecord" } };
  }

  const tokens = unescapeTagValue(match[1])
    .split(/\s+/)
    .filter((token) => token.length > 0);
  const editionId = tokens[0] ?? "";
  if (!isKnownEditionId(editionId)) {
    return {
      kind: "error",
      error: { kind: "unknownRuleset", ruleset: editionId },
    };
  }
  const edition = EDITIONS[editionId];

  const { configuration, unrecognizedTokens } = parseRuleFlagTokens(
    edition,
    tokens.slice(1),
  );

  const parseResult = parseRecordFile(text, edition.boardLayout);
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

  return {
    kind: "parsed",
    record: replayResult.record,
    configuration,
    unrecognizedRuleTokens: unrecognizedTokens,
  };
}

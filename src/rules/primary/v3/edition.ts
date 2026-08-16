// Edition identity for ruleset major 3, written from `reference/rules.md`'s
// Appendix ("Ruleset and edition") alone - never by copying the existing
// major-2 rule engine.
//
// Major 3 publishes no rule settings at all (rules.md §1 "One ruleset", and
// the Appendix's "Proposed" table: "*(none - this major publishes no rule
// settings)*"). The whole game is described by rules.md's text, with nothing
// left to vary between editions - so, unlike major 2, this folder has no
// `configuration.ts`, no `games.ts`, no flag catalog, and no
// `BoardLayout`/`ArmyComposition` registry, and never will: there is nothing
// for them to select between. The `Ruleset` record tag for a major-3 game is
// therefore always a **bare edition id**, with no deviating tokens appended -
// contrast major 2's tag, which can carry deviations after the edition id.
//
// `PRE_RELEASE_EDITION_ID` below is the **only** place this folder's source
// spells out the edition id literal (grepped by this story's Step 1
// verification - the tests below necessarily repeat it, to guard the literal
// itself). "PRE-RELEASE" is explicitly a working name (rules.md Appendix:
// "Settings will be introduced if and when a rule genuinely needs to vary" -
// the name itself is likewise provisional, and reuses a name already retired
// at major 1), so a rename stays a one-line edit here.

/** The one edition ruleset major 3 currently defines. See module comment: a working name. */
export const PRE_RELEASE_EDITION_ID = "3-0:PRE-RELEASE";

/** The type of `PRE_RELEASE_EDITION_ID` - major 3 has exactly one edition id. */
export type EditionId = typeof PRE_RELEASE_EDITION_ID;

/**
 * The `Ruleset` record tag value for a major-3 game: always the bare edition
 * id. Exposed as a function (rather than just the constant above) so callers
 * that want "the tag to write" and callers that want "the edition id to
 * compare against" each have an obviously-named thing to reach for, even
 * though today they hold the same value.
 */
export function rulesetTag(): EditionId {
  return PRE_RELEASE_EDITION_ID;
}

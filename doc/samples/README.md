# Sample recorded games

Checked-in fixture files for tests that need to read a genuinely well-formed
record from disk rather than a string built inline. Each one was produced via
the app's own record writer (`renderGameRecord`, `src/rules/primary/v2/play.ts`)
so its structure — header tags, position block, move notation — is exactly
what a real game dump looks like; any hand-editing after that is called out
below.

## `2-0-skirmish-tower-in-lane.txt`

Story 00000025 ("Add tower restriction"). A short, complete `2-0:SKIRMISH`
game — the historical Skirmish edition, in which a Tower directly in front of
a lane was still legal — whose starting position has a White Tower on **A3**,
a square that the newer `2-1:SKIRMISH` edition refuses at placement time.

This pins the guarantee that placement rules are never consulted during
replay: `readRecord` must parse and replay this file to the end without
complaint, exactly as it does for any other well-formed record, even though
the position it starts from could never be _placed_ under `2-1:SKIRMISH`. It
is read both by an automated test
(`src/rules/readRecord.test.ts`) and by the owner at this story's manual
Gate D — one artifact, so it can never rot out of sync with the other.

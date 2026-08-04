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

## `2-1-skirmish-diagonal-attackable-all.txt`

Story 00000027 ("Add diagonal flags"), Step 6. A short, complete
`2-1:SKIRMISH` game recorded under `DIAGONAL_ATTACKABLE=all` — the proposed
value that makes a Tower or the Flag a legal diagonal target, not just a
numbered piece. A White Champion at D3 attacks the Black Flag standing
diagonally at E4, which is only a legal target because of this flag; the
attack captures it outright, ending the game.

## `2-1-skirmish-diagonal-attack-path-open.txt`

Story 00000027, Step 6. A short `2-1:SKIRMISH` game recorded under
`DIAGONAL_ATTACK_PATH=open_path` — the proposed value that additionally
requires at least one of the two squares flanking a diagonal attack to be
free. A White Champion at D3 attacks a Black Militia standing diagonally at
E4; one flank (E3) is blocked by a Black Tower, but the other (D4) is open,
so the attack is legal. The game is left ongoing after the one move (`Result
"*"`), demonstrating a record that was exported mid-game.

## `2-1-skirmish-diagonal-both-flags.txt`

Story 00000027, Step 6. A short, complete `2-1:SKIRMISH` game recorded under
both `DIAGONAL_ATTACKABLE=all` and `DIAGONAL_ATTACK_PATH=open_path` together.
A White Champion at D3 attacks the Black Flag standing diagonally at E4 —
legal only because of both flags at once: `all` makes the Flag a legal
diagonal target at all, and the open flank at D4 (the other, E3, is blocked
by a Black Tower) satisfies `open_path`. The attack captures the Flag,
ending the game.

Unlike `2-0-skirmish-tower-in-lane.txt` above, these three were hand-built
(matching the writer's exact format — header tags, position block,
extended-notation move — rather than produced by playing a live game)
because Step 6 lands before the new-game screen offers either flag as a
player choice (Steps 7–9); an automated test drives each through
`readRecord` to prove it parses and replays as claimed. Each is also read by
the owner at this story's manual Gate E — one artifact per fixture, so the
automated guarantee and the manually-verified record can never drift apart.

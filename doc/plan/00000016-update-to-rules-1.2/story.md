# Story 00000016 — Update to rules 1.2

## Summary

The game's rules have been revamped. The companion project published ruleset
**version 1.2** (its story 00000018, 2026-07-14) — a near-total redesign of
the game this app plays — and this story makes the app play that game.

This is a **replacement, not an addition**. The old ruleset wasn't working
out, the game is pre-release, and nothing recorded or built under the 1.1
rules needs to keep working. The 1.1 rule code is rewritten in place, and
games recorded under 1.1 stop being readable — deliberately.

What a player sees change:

- **A smaller, simpler army.** 25 pieces instead of 48: three each of six
  ranked pieces — Master-of-Arms (1), Champion (2), Knight (3), Halberdier
  (4), Foot Soldier (5), Militia (6) — plus six Towers and the Flag. The
  Skirmisher, Archer, Sapper and Assassin are gone.
- **No special abilities.** Every ranked piece moves and fights the same way.
  In their place, two general mechanics: a **formation bonus** (a piece with
  an equal-ranked ally beside it draws against a piece one rank stronger,
  instead of losing) and an **unencumbered bonus** (a piece with no enemies
  around it may move two squares instead of one).
- **Placement is a choice.** The army no longer fills the home zone: 25
  pieces go on any 25 of your 48 home squares — and no two of your Towers
  may sit next to each other, not even diagonally.
- **Towers trade.** Any piece may attack a Tower; both are removed.
- **One inactivity rule.** 50 consecutive moves with no piece removed and
  the game is a draw. The old per-player inactivity loss and separate
  progress counter are gone, as is the Unbreachable Flag win.

## Background & references

- `doc/ruleset/rules.md` in the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  repository is the single source of truth and is not restated here. This
  story is written against **version 1.2** (see that repo's
  `doc/ruleset/changelog.md`, entry for story 00000018).
- `doc/ruleset/technical-notes.md` there documents the record file format,
  including the new `Ruleset` tag form `VERSION:NAME` — currently
  `1.2:PRE-RELEASE` — and the companion repo's **latest-version-only**
  policy: it keeps no code for reading games recorded under earlier rules.
- The current rule code lives in `src/rules/primary/v1_1/` (~7,000 lines
  including tests): pieces, placement, movement, combat, outcome,
  reachability, notation, game state, play session, record writer, record
  reader, and blind replay.
- The board is unchanged in 1.2: same 12×12 grid, same home zones, same
  three 2×2 lakes.

## Policy (fixed by the owner, 2026-07-18)

- **Replace, don't version.** The rule code is rewritten as the 1.2 rules;
  no 1.1 logic is kept, and `PRIMARY:1.1` records will not remain
  replayable. The "recorded games stay replayable forever" principle is
  suspended while the game is pre-release.
- **One code folder per major version.** The folder is renamed
  `src/rules/primary/v1_1/` → `src/rules/primary/v1/`, on the expectation
  that all future 1.x rulesets (1.3, 1.4, …) stay consistent enough to run
  on the same engine code. (1.2 would have been a 2.0 were the game not
  pre-release; from here, minors within a major are non-breaking.)
- **Follow the companion repo's documented standards as they are** — the
  earlier ruleset-variants redesign is deferred. In particular the `Ruleset`
  tag uses their `VERSION:NAME` form: `1.2:PRE-RELEASE`.
- **Piece continuity.** Lord Marshal → Master-of-Arms and Infantry → Foot
  Soldier are straight renames and keep their icons. Halberdier and Foot
  Soldier swap ranks (Halberdier is now 4, Foot Soldier 5) — the corner
  numeral on the tile follows the catalog automatically, since it is overlay
  text, not baked into the art. The retired pieces' sprites (Skirmisher,
  Archer, Sapper, Assassin) **stay in the sprite sheet**, unreferenced.
- **Records are the next story's problem.** This story keeps the writer and
  reader compiling, mirrored, and honest (new symbols, new tag), but
  verifying the reviewer against real engine-produced 1.2 records — and the
  placement experience beyond minimal correctness — is story 00000017.
  Between the two stories the reviewer has no verified real-world input;
  that interim state is accepted.

## Players and colors

Unchanged: first player = White = Side A = red (`#a13d2b`); second player =
Black = Side B = blue (`#33526b`). (Rules 1.2 now states the White/Black
standard explicitly in its overview — the app already follows it.)
Player-facing surfaces name the sides by color (red / blue), use the rules'
piece names exactly as written there (e.g. "Master-of-Arms", "Foot
Soldier"), and use the word "move" (never "ply").

## In scope

1. **The new army.** The piece catalog becomes the 1.2 roster: ranks 1–6,
   three of each, six Towers, one Flag — 25 pieces. Renames and the
   Halberdier/Foot Soldier rank swap flow through everywhere the pieces
   appear: tray, board tiles, announcements, the record's position-block
   symbols (now only `1`–`6`, `T`, `F`).
2. **Placement under the new rules.** The existing tray-and-board placement
   flow now places 25 pieces on any of the 48 home squares the player
   chooses; the rest stay empty. A player cannot finish placing while two of
   their Towers are adjacent (orthogonally or diagonally); the restriction
   is explained in plain language when it bites. This story keeps the
   existing placement interaction otherwise unchanged — the fuller
   placement experience is story 00000017.
3. **Movement.** One square orthogonally as the baseline; a piece that is
   **unencumbered** (no enemy piece in any of its eight surrounding squares)
   may instead move two squares orthogonally through an empty intermediate
   square. Lakes stay impassable, diagonal moves stay illegal, friendly
   squares stay blocked. The board's move highlighting offers exactly the
   legal moves, including the two-square options when they apply.
4. **Combat.** Lower rank beats higher; equal ranks trade; the **formation
   bonus** (an adjacent equal-ranked ally, judged for the attacker before
   its move and for the defender at the moment it is attacked) turns a loss
   against a one-rank-stronger piece into a trade; **any** piece attacking a
   Tower trades with it; capturing the Flag wins immediately. All the old
   special abilities (charge, rush, support, tower-destruction, Assassin
   rules) are removed.
5. **Endings.** Flag capture wins; a player with no legal move loses; a
   single shared inactivity counter rises by one on every move that removes
   no piece, resets to zero on any removal, and ends the game as a draw at
   50. Draw by agreement is unchanged. The Unbreachable Flag win, the
   per-player inactivity loss and the progress counter are removed, along
   with the reachability machinery that existed to serve them.
6. **The rules module becomes `v1`.** The folder rename, with imports,
   internal test fixtures and the developer record dump updated alongside;
   the serialized `Ruleset` tag becomes `1.2:PRE-RELEASE` (writer and
   reader dispatch both), so nothing this app now produces claims to be a
   1.1 game.
7. **The app works at every step.** A hot-seat game — placement, play,
   ending, record dump — is playable throughout the story, with each step
   verified and committed per the standard pipeline.
8. **Accessibility maintained.** Announcements, labels and instructions
   keep pace with the new names and mechanics (the tower restriction, the
   two-square moves, the new endings), preserving the established keyboard
   and screen-reader patterns.

## Design decisions & constraints

- **No compatibility shims, no flags.** The 1.2 rules are implemented
  directly; there is no toggle back to 1.1 behavior and no dead 1.1 code
  retained. (The flags/variants architecture remains deferred, not
  smuggled in.)
- **The writer and reader stay mirrored.** The record reader lives beside
  the writer in `v1` and keeps round-tripping what the writer emits; its
  test fixtures become small synthetic 1.2 records. Old `PRIMARY:1.1`
  sample files are removed with the code that could read them — a 1.1 file
  presented to the reviewer is rejected as an unknown ruleset, which is the
  truthful answer.
- **Rank numerals come from the catalog.** No sprite-sheet edits for the
  rank swap; the only art-adjacent change is the piece-id → sprite-symbol
  mapping (Master-of-Arms uses `p-marshal`, Foot Soldier uses
  `p-infantry`).
- **The tower restriction is placement-side only.** It constrains where
  Towers may be placed (rules §3); it is not re-checked during play —
  Towers never move.
- **Player-facing text** follows rules.md's names and vocabulary; rule
  concepts a player meets in the UI (unencumbered, formation, the tower
  rule) are described in plain words, not rulebook jargon.

## Out of scope

- **The placement experience** beyond minimal correctness — richer
  as-you-place feedback for the Tower rule, arrangement aids, tray
  presentation for the new roster (story 00000017).
- **Verifying the reviewer against real engine-produced 1.2 records**, and
  refreshing the sample-record tests with real engine output (story
  00000017).
- **Switching the emitted record to the extended notation** and **saving a
  played game to a file** — still deferred (owner, reconfirmed 2026-07-18);
  games played in this app remain unreviewable in it until those land.
- Any 1.1 compatibility: reading, replaying, or converting old records.
- New AI/analysis features; the variants/flags ruleset architecture.

## Manual-verification gates

- **Gate A — Placement.** Both players place 25 pieces on squares of their
  choosing; empty home squares are allowed and evident. Placing all pieces
  with two Towers adjacent (including diagonally) blocks finishing, with a
  message a player can act on; separating them unblocks it. The reveal
  shows both sparse armies correctly, with the renamed pieces and swapped
  rank numerals right on their tiles.
- **Gate B — Movement and combat.** A piece with no adjacent enemies is
  offered two-square moves (blocked paths and lakes excluded); a piece with
  an enemy beside it is offered only single steps. An equal-rank attack
  trades; a formation-supported piece trades against a one-rank-stronger
  piece where it would otherwise simply lose (checked in both the
  attacking and defending directions); any piece attacking a Tower removes
  both; no removed ability fires anywhere.
- **Gate C — Endings and the record.** Flag capture ends the game
  immediately with the right winner; a drawn-out maneuvering sequence ends
  in a draw at the 50th quiet move (the counter's reset on a capture is
  covered by tests; the gate spot-checks the draw itself); draw by
  agreement still works. The developer record dump of a finished game
  carries `Ruleset "1.2:PRE-RELEASE"`, the new position-block symbols, and
  a plausible result and reason.
- **Gate D — Accessibility.** With the mouse put away, placement (including
  recovering from the Tower restriction) and a stretch of play (including a
  two-square move and a trade) are workable by keyboard alone, with the
  screen reader announcing the new piece names and outcomes correctly.

## Open items to resolve at plan time

Presentation and structure only — the policy above is fixed:

- Confirm the two-square move's edge cases against the reference engine and
  rules text (straight line only; whether the second square may be an
  attack; encumbrance judged only at the starting position).
- Confirm the exact position-block symbol set and any record-format details
  against `technical-notes.md` as it stands at plan time.
- The step decomposition that keeps the app green at every commit (likely:
  catalog and placement first, then movement, combat, endings, then the
  folder rename and tag) — and where the placement UI's minimal
  tower-restriction messaging surfaces (the existing status/announcement
  line vs. disabling the finish control with an explanation).
- Whether any existing UI copy (instructions, help text) references removed
  mechanics and needs rewording beyond the mechanical renames.

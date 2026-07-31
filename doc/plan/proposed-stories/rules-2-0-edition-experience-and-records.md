# Proposed story — Two-edition experience and records for rules 2.0

**Status:** proposed (not yet a numbered story). Story numbers come from GitHub
and are chosen by the repository owner; do not assign one here or create a
numbered `doc/plan/NNNNNNNN-…` folder until it is picked up. This is the
follow-up to story 00000023 (Update to rules 2.0), mirroring how story 00000017
followed 00000016.

## Motivation

Story 00000023 makes the app play major 2 correctly: both editions
(`2-0:BATTLE`, `2-0:SKIRMISH`), diagonal attacks, a parametric board, a per-game
Battle/Skirmish choice (Skirmish default), hot-seat play end to end, and records
that round-trip. It deliberately leaves two things minimal, exactly as 00000016
left placement-experience and real-record verification to 00000017:

1. **Choosing and playing a game becomes a designed experience, not just a
   correct one.** The Battle/Skirmish choice should read clearly to a new player
   — what each game is, why Skirmish is the gentler start — and placement should
   feel good on *both* boards, including Skirmish's tighter, buffer-less 8×8
   layout where the armies start close together. Whatever board-specific comfort
   the 00000023 plan judged out of scope lands here.

2. **The reviewer meets real 2.0 games.** Since story 00000023 the reviewer
   round-trips only *synthetic* records. This story closes the loop against
   **real** output from the companion project's reference engine, for **both**
   editions: games tagged `2-0:BATTLE` and `2-0:SKIRMISH` import and replay
   correctly, verified against real engine renderings, and the sample-record
   tests are refreshed to real records (covering diagonal attacks, trades,
   formation-bonus draws, Tower trades, a Flag capture, and at least one drawn
   game, on each board size).

## Background & references

- Rules: `doc/ruleset/rules.md` (major 2, editions `2-0:BATTLE` /
  `2-0:SKIRMISH`) and the size-parametric record format in
  `doc/ruleset/technical-notes.md`, both in the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  repository. The reference engine emits the extended result-marking notation
  and tags records with the edition id.
- The reviewer is a rules-blind viewer: it renders the position block and
  replays the extended notation at face value, recovering board dimensions from
  the block. What this story adds on the records side is chiefly **verification
  against real engine output** for both editions, not new machinery.

## Likely scope (to be firmed up when picked up)

- Designed presentation of the Battle/Skirmish choice (plain-language framing of
  each game; Skirmish recommended).
- Placement comfort tuned per board — at minimum a clear-the-board action, plus
  a tray/status presentation that reads well for both the 16- and 25-piece
  armies and the tighter Skirmish view.
- Real engine-produced 2.0 records import and replay end to end for both
  editions; discrepancies fixed on the reader's side (engine output is the
  standard).
- Sample-record tests refreshed to real 2.0 records for both boards; synthetic
  fixtures kept only where they test something real records can't (malformed
  files, rejections).
- Rejection copy reviewed against the new reality — a `1.2:PRE-RELEASE` record,
  or any unknown edition, gets a plain-language "recorded under rules this app
  doesn't play" message.

## Dependencies / notes for the owner

- **Real records must be generated from the companion repo** (this container has
  no checkout) — ideally several per edition, collectively covering the cases
  above. A couple become committed sample files for the reader's sample-based
  tests.
- Re-enabling computer play (a new engine spec, re-encoding, retraining) is
  **not** part of this story; it is its own track once the engine is respecified.

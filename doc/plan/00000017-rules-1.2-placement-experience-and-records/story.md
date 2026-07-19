# Story 00000017 — Placement experience and records for rules 1.2

> **Status: draft.** Written alongside story 00000016 because the two are
> closely related; the **Proposed policy** section below needs the owner's
> decisions before this story is implemented. Everything else is expected to
> hold, subject to how those decisions land.

## Summary

Story 00000016 makes the app play the 1.2 rules correctly. This story
finishes the two things it deliberately left minimal:

1. **Placing an army becomes a designed experience, not just a legal one.**
   Under 1.2 a player arranges 25 pieces on 48 squares — which squares to
   fill is now a real decision, and the "no two Towers together" rule is a
   constraint a player can trip over. Placement should make the open choice
   feel natural, keep the Tower rule visible before it blocks you, and make
   fixing a violation easy.
2. **The reviewer meets real games again.** Since the rules revamp, the
   review screen has had no verified real-world input. This story closes the
   loop: games recorded by the companion project's reference engine under
   ruleset 1.2 import and replay correctly, verified against real engine
   output, and the sample-record tests are refreshed to match. A player
   handed an old (pre-1.2) record gets a plain answer: this app can't review
   games recorded under older rules.

## Background & references

- Rules: `doc/ruleset/rules.md` (version 1.2) and the record format in
  `doc/ruleset/technical-notes.md`, both in the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  repository. The reference engine emits the extended result-marking
  notation and tags records `Ruleset "1.2:PRE-RELEASE"`.
- The reviewer (story 00000014) is a rules-blind viewer: it replays the
  extended notation at face value and never applies rules. Its record
  reader lives beside the writer in `src/rules/primary/v1/` (renamed from
  `v1_1` in story 00000016), which also switched the tag both write and
  read to `1.2:PRE-RELEASE`. What this story adds on the records side is
  therefore chiefly **verification against real engine output** and fixing
  whatever that shakes out, not new machinery.
- Placement mechanics after story 00000016: the existing tray flow places
  25 pieces on chosen squares, and finishing is blocked (with a message)
  while two of the player's Towers are adjacent.

## Proposed policy (pending owner decisions)

Marked **[owner]** where a call is needed; proposals are the recommended
defaults.

- **[owner] Tower rule: prevent or flag?** Proposal: **flag, don't
  prevent** — a player may put a Tower anywhere legal-for-placement, but
  offending Towers are visibly marked the moment two are adjacent, the
  status line says why, and finishing stays blocked until it's fixed.
  (Preventing the drop outright is the alternative: simpler to understand,
  but it makes rearranging feel obstructive — you can't temporarily park a
  Tower while shuffling.)
- **[owner] Arrangement aids.** Proposal: keep it modest — a **clear the
  board** action (return everything to the tray) and nothing more. Random
  or suggested setups are fun but are a feature decision, not a
  completeness requirement; they can be their own story if wanted.
- **[owner] Real engine records for verification.** The final gates need
  games produced by the companion repository's batch runner under 1.2 —
  ideally several, collectively covering captures, trades, formation-bonus
  draws, Tower trades, two-square moves, a Flag capture, and at least one
  drawn game. Proposal: the owner generates these from the companion repo
  (this container has no checkout); a couple become committed sample files
  for the reader's sample-based tests.
- **Old records are answered kindly** (not open): a file whose `Ruleset`
  tag names a ruleset this app doesn't know — including any pre-1.2 tag —
  is rejected with a message saying the game was recorded under rules this
  app doesn't play, in words a player can act on. (The mechanism exists
  since story 00000014; this story makes sure the message covers the
  "older rules" case naturally.)

## In scope

1. **Placement feedback for the Tower rule.** The rule is discoverable
   before it blocks finishing: adjacent Towers are marked on the board as
   soon as they occur, the explanation names the rule in plain words, and
   resolving the conflict clears the marking immediately. Conveyed
   accessibly, not just visually.
2. **Placement comfort for a sparse army.** Whatever the owner's decisions
   above settle on (at minimum: clearing the board), plus a tray and status
   presentation that reads well for the 1.2 roster — eight piece types,
   counts of three, and the fact that empty squares are normal and fine.
3. **Real-record verification of the reviewer.** Engine-produced 1.2
   records import and replay end to end; discrepancies between what the
   engine writes and what the reader accepts are found and fixed on the
   reader's side (the engine's output is the standard).
4. **Sample-record tests refreshed.** The committed sample files driving
   `readRecord.samples.test.ts` become real 1.2 engine records; synthetic
   fixtures remain only where they test something real records can't
   (malformed files, rejections).
5. **Rejection copy for unknown and older rulesets** reviewed against the
   new reality: a pre-1.2 record, or a future ruleset, gets a message that
   tells the player what's wrong without technical vocabulary.

## Out of scope

- **Switching this app's own emitted record to the extended notation**, and
  **saving a played game to a file** — still the standing backburner pair;
  until both land, games played in this app remain unreviewable in it.
- Random/suggested placements (unless the owner's decision above pulls a
  minimal version in).
- Saving or restoring placement layouts between games.
- Any change to play, combat, endings, or the review screen's controls.
- Converting or importing pre-1.2 records.

## Manual-verification gates (draft)

- **Gate A — Placement experience.** A player who doesn't know the Tower
  rule discovers it from the UI alone: creating an adjacency shows the
  marking and explanation, fixing it clears them, and finishing is blocked
  only while a violation exists. Clearing the board returns all 25 pieces
  to the tray. All of it works by keyboard, with the state changes
  announced.
- **Gate B — Real games review correctly.** Each verification record from
  the reference engine imports and replays to its final position; spot
  checks against the engine's own rendering of interim positions agree;
  the recorded result and reason are shown as the record claims.
- **Gate C — Old and foreign records.** A pre-1.2 record and a record with
  a fabricated future ruleset tag are both rejected with the
  plain-language message; a photo (non-record file) still gets the
  not-a-record rejection from story 00000014.

## Open items to resolve at plan time

- The visual and announced form of the adjacency marking on the placement
  board (reusing the existing highlight/live-region patterns).
- Where the clear-the-board control sits and how it's confirmed (it
  discards up to 25 placements — probably a confirm, mirroring the app's
  existing leave-game pattern).
- Which real engine records become committed samples, and how large a
  record the sample tests can comfortably carry.

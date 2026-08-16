# Pinned snapshot — companion `doc/ruleset/proposed-3/`

**This is a reference copy, not a source of truth.** The single source of
truth for major 3 is `doc/ruleset/proposed-3/` in the companion
[capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
repository. Nothing in this folder may be edited: if the proposal changes,
re-copy it and note the new commit below.

## Why it is here

Major 3 is a **draft**. It can change or be abandoned while this story is
being implemented, and the story is built against one specific version of it.
Pinning that version into the story folder means every agent in the
`/implement-story` pipeline — each of which starts with a cold context and no
network guarantee — reads the same rules text the story was written from, and
means a reader coming back to this story later can tell what was actually
implemented from what the proposal says today.

This is a snapshot of a *proposal*, deliberately kept inside `doc/plan/`. It
is not a fork of the published rules, which stay in the companion repository
and are only ever linked to.

## Source

| | |
| --- | --- |
| Repository | `phil-hutchinson/capture-the-flag` |
| Path | `doc/ruleset/proposed-3/` |
| Commit | `b3c3202` (`b3c320207d20cd1016382299a54a0080ce9d8d64`) |
| Merged | 2026-08-16 — "Feat/46 document ruleset three (#48)" |
| Copied | 2026-08-15 |

## Contents

The five files beside this one are **verbatim** copies, unedited. Their
internal links (`../rules.md`, `../../plan/…`) resolve against the companion
repository's own layout, not this one, and are left as written rather than
rewritten — rewriting them would make the copy no longer verbatim.

| File | What it holds |
| --- | --- |
| `rules.md` | the complete proposed ruleset, player-facing and self-contained |
| `start-position.md` | how a starting position is generated, and how a position ID encodes one |
| `changelog.md` | the entry major 3 *would* publish — the delta from major 2 |
| `technical-notes.md` | design rationale and consumer-facing hazards |
| `README.md` | the proposal folder's own README (its links point at the companion repo) |

Start with `rules.md` and `start-position.md`: together they are complete, and
neither requires reading the major-2 rules first. `changelog.md` is the
fastest route to *what changed* for anyone who already knows major 2.

# Capture the Flag — Play in Your Browser

Capture the Flag is a two-player battlefield board game. Each player secretly
arranges an army of 25 pieces — soldiers, knights, towers, and one
all-important flag — then the armies are revealed and the battle begins. Pieces
move and clash in full view until one side captures the other's flag.

This is the game's web app. It runs entirely in your browser — nothing to
install, no account, no server. It opens on a start screen with two choices:
play a game, or review a recorded one.

## What you can do

- **Set up a game with a friend** on the same device — take turns secretly
  choosing where on your side of the board to place your 25-piece army (you
  won't fill every square), then hand off. When both armies are placed, the
  game is ready for battle.
- **Move, attack, and capture on the battlefield** — once both armies are
  revealed, take turns moving pieces across the board in full view. Moving a
  piece onto an enemy piece attacks it, and the fight resolves immediately —
  the losing piece (or both, if they're evenly matched) leaves the board. By
  default the board flips to face whoever's turn it is; a "Flip board between
  turns" switch lets you turn that off and keep the board on red's side the
  whole game — handy if you're playing both sides yourself.
- **Win, lose, or draw** — capture your opponent's flag and the game is yours.
  You can also win if your opponent is left with no legal move at all. A game
  can end in a draw too: by agreement, or if fifty moves go by in a row with
  no piece captured — you'll see a warning as that point gets close. However
  it ends, the app tells you who won and why, leaves the final position on
  screen, and offers you a new game.
- **Review a recorded game** — choose a game record file from your device and
  watch the battle again: step forward and back a move at a time, jump to the
  start or the end, or click any move in the list to go straight to it. The
  board shows the last move made, and at the end you see the result the record
  claims. The file is read on your device — nothing is uploaded. Records come
  from the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  project's engine; a game you play here can't be saved or reviewed yet.
- **Play against the computer** — an AI opponent trained by the companion
  [capture-the-flag](https://github.com/phil-hutchinson/capture-the-flag)
  project. _(planned, once the AI engine is trained)_

> **Status:** you can play a full game from start to finish — place both
> armies, battle on the revealed board, and reach a real result — and you can
> review a recorded game move by move. Saving a game you played here, and
> playing against the computer, are still to come.

## The rules

The official rulebook lives in the companion repository and is the single
source of truth:
[rules.md](https://github.com/phil-hutchinson/capture-the-flag/blob/main/doc/ruleset/rules.md)
(with a [change log](https://github.com/phil-hutchinson/capture-the-flag/blob/main/doc/ruleset/changelog.md)).
The game is still in active pre-release development, and the rules are
evolving with it; a recorded game only plays back correctly in the ruleset
version it was recorded under, and older recordings may stop working as the
rules change.

## Development

The app is a TypeScript/React single-page application with no backend — it can
be served from any static file host. The repo ships a VS Code Dev Container
that provisions the full toolchain automatically; see
[CONTRIBUTING.md](CONTRIBUTING.md) for setup and conventions.

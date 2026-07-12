# Story 00000010 — Tile image cleanup

## Summary

A small art cleanup of three piece icons in the sprite sheet
(`src/art/pieceSprites.svg`). No behavior changes — shapes only.

The driving problem: the Flag and the Halberdier read too much alike — both
were a plain triangle on a pole, easy to confuse at board size. While in the
icons, the Lord Marshal's axe also got rebalanced.

## In scope

1. **Flag** — replace the triangular pennant with a waving rectangular banner
   (top and bottom edges carry the same wave so it reads as a rectangle caught
   in the wind).
2. **Halberdier** — make the pole arm definitively a halberd, focused on the
   business end and with more construction than the old two flat triangles: a
   leaf-shaped spear point, an axe head with a concave cutting edge whose top
   horn reaches out past the bottom horn, and a smaller curved-triangle rear
   fluke on the back of the shaft.
3. **Lord Marshal** — the axe head was a little too big at the top and
   unbalanced the icon. Flip the axe head over so the blade points up (clear
   of the corner rank numeral), shrink it about 20% along the shaft (taken
   from the top, with the haft tip shortened to match) and make it stick out
   about 10% less.

## Design decisions

- All three shapes were iterated visually with the owner and approved from
  before/after renders on the real parchment and side colors, at full and
  board sizes (2026-07-11/12).
- The changed icons must stay clear of the corner rank numeral drawn by
  `PieceIcon` and remain legible at small board sizes in both side colors.

## Out of scope

- The other nine piece symbols and the lake terrain sprite.
- Any change to how sprites are rendered, tokenized, or consumed
  (`PieceIcon.tsx` is untouched).

// Verifies the committed sprite source (pieceSprites.svg) per story
// 00000001's themeability constraint: all 13 symbols are present, none of
// the prototype's literal side/cutout colors survived, and the four cutout
// details reference the board-background variable instead.
import { describe, expect, it } from "vitest";
import spriteSource from "./pieceSprites.svg?raw";

const EXPECTED_SYMBOL_IDS = [
  "p-marshal",
  "p-champion",
  "p-knight",
  "p-infantry",
  "p-halberdier",
  "p-militia",
  "p-skirmisher",
  "p-archer",
  "p-sapper",
  "p-assassin",
  "p-tower",
  "p-flag",
  "p-lake",
];

/** Extracts the inner markup of a `<symbol id="...">...</symbol>` block. */
function symbolBody(id: string): string {
  const match = spriteSource.match(
    new RegExp(`<symbol id="${id}"[^>]*>([\\s\\S]*?)</symbol>`),
  );
  if (!match) {
    throw new Error(`symbol #${id} not found in pieceSprites.svg`);
  }
  return match[1];
}

describe("pieceSprites.svg", () => {
  it("contains all 12 piece symbols plus the p-lake terrain symbol", () => {
    for (const id of EXPECTED_SYMBOL_IDS) {
      expect(spriteSource).toContain(`<symbol id="${id}"`);
    }
  });

  it("contains no literal prototype side colors", () => {
    expect(spriteSource).not.toContain("#a13d2b");
    expect(spriteSource).not.toContain("#33526b");
  });

  it("contains no literal prototype cutout color", () => {
    expect(spriteSource).not.toContain("#e8dfc8");
  });

  it("re-tokenizes the four cutout details to the background variable", () => {
    // Champion's blade fuller (groove).
    expect(symbolBody("p-champion")).toContain("var(--parchment)");
    // Knight's eye + mouth line.
    const knight = symbolBody("p-knight");
    expect(knight.match(/var\(--parchment\)/g)).toHaveLength(2);
    // Infantry's shield cross-lines.
    expect(symbolBody("p-infantry")).toContain("var(--parchment)");
    // Tower's doorway.
    expect(symbolBody("p-tower")).toContain("var(--parchment)");
  });

  it("leaves the deliberately-fixed accents literal", () => {
    // Marshal's boss (gold), same for both sides.
    expect(symbolBody("p-marshal")).toContain("#a67c2e");
    // Lake wave strokes.
    const lake = symbolBody("p-lake");
    expect(lake.match(/#3f7b8a/g)).toHaveLength(3);
  });
});

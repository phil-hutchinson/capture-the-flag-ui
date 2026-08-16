import { describe, expect, it } from "vitest";
import { viewSquareKey } from "./viewModel.ts";

describe("viewSquareKey", () => {
  it("concatenates column and row, e.g. A1", () => {
    expect(viewSquareKey({ column: "A", row: 1 })).toBe("A1");
  });

  it("agrees with major 2's own squareKey format for a multi-digit row", () => {
    expect(viewSquareKey({ column: "L", row: 12 })).toBe("L12");
  });
});

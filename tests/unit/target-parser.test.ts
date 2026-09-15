import { describe, expect, it } from "vitest";
import { parseTargetValue } from "../../src/import/target-parser";

describe("parseTargetValue", () => {
  it.each(["Target", "priority", "x", "no", 1, 0, true, false])(
    "treats the non-empty value %j as a target marker",
    (value) => {
      expect(parseTargetValue(value)).toBe(true);
    },
  );

  it.each(["", "   ", null, undefined])("treats %j as an unmarked target cell", (value) => {
    expect(parseTargetValue(value)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { extractSleeperDraftId } from "../../src/content/draft-url-parser";

describe("extractSleeperDraftId", () => {
  it.each([
    ["https://sleeper.com/draft/nfl/123456789012345678", "123456789012345678"],
    ["https://sleeper.com/draft/nfl/1401806993487896576?ftue=commish", "1401806993487896576"],
    ["https://sleeper.app/draft/123456789012345678", "123456789012345678"],
    ["https://sleeper.com/mock-draft/nfl/123456789012345678?tab=board", "123456789012345678"],
  ])("extracts a draft ID from %s", (url, expected) => {
    expect(extractSleeperDraftId(url)).toBe(expected);
  });

  it.each([
    "not-a-url",
    "https://example.com/draft/nfl/123456789012345678",
    "https://sleeper.com/leagues/123456789012345678",
  ])("rejects a non-draft URL: %s", (url) => {
    expect(extractSleeperDraftId(url)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { buildDraftSnapshot } from "../../src/draft/draft-state";
import type { SleeperDraft, SleeperDraftPick } from "../../src/types/draft";

describe("buildDraftSnapshot", () => {
  it("uses the first open slot as the current pick when future keepers exist", () => {
    const snapshot = buildDraftSnapshot(
      draft(),
      [pick(1, "a"), pick(2, "b"), pick(8, "keeper", true)],
      new Date("2026-09-04T12:00:00.000Z"),
    );

    expect(snapshot).toMatchObject({
      totalPicks: 12,
      currentPick: 3,
      completedPickCount: 2,
      futureKeeperCount: 1,
      lastSuccessfulSyncAt: "2026-09-04T12:00:00.000Z",
    });
    expect(snapshot.draftedPlayerIds).toEqual(["a", "b", "keeper"]);
  });

  it("marks a fully occupied draft complete", () => {
    const picks = Array.from({ length: 12 }, (_, index) => pick(index + 1, String(index + 1)));
    expect(buildDraftSnapshot(draft(), picks).currentPick).toBeNull();
  });
});

function draft(): SleeperDraft {
  return {
    draftId: "12345678",
    name: "Test Draft",
    status: "drafting",
    type: "snake",
    teams: 4,
    rounds: 3,
    draftOrder: {},
    slotToRosterId: {},
    creatorUserIds: [],
  };
}

function pick(pickNumber: number, playerId: string, isKeeper = false): SleeperDraftPick {
  return {
    playerId,
    pickNumber,
    round: Math.ceil(pickNumber / 4),
    draftSlot: ((pickNumber - 1) % 4) + 1,
    isKeeper,
  };
}

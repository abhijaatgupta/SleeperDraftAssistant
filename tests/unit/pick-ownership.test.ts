import { describe, expect, it } from "vitest";
import {
  buildDraftPickOwnership,
  findUpcomingOwnedPicks,
  resolveUserDraftIdentity,
} from "../../src/draft/pick-ownership";
import type {
  DraftSnapshot,
  SleeperDraft,
  SleeperDraftPick,
  SleeperTradedPick,
  SleeperUserIdentity,
  UserDraftIdentity,
} from "../../src/types/draft";

describe("resolveUserDraftIdentity", () => {
  it("uses a saved Sleeper user when that user is in the draft order", () => {
    expect(resolveUserDraftIdentity(draft(), user())).toMatchObject({
      draftSlot: 3,
      rosterId: 30,
      automatic: false,
    });
  });

  it("automatically resolves the only real user in a mock draft", () => {
    const mockDraft = draft({ draftOrder: { only_user: 2 } });

    expect(resolveUserDraftIdentity(mockDraft, null)).toMatchObject({
      user: { userId: "only_user" },
      draftSlot: 2,
      rosterId: 20,
      automatic: true,
    });
  });

  it("requires a saved identity when multiple users are present", () => {
    expect(resolveUserDraftIdentity(draft(), null)).toBeNull();
  });
});

describe("buildDraftPickOwnership", () => {
  it("generates the correct selections for a snake draft", () => {
    expect(overallPicks(buildDraftPickOwnership(draft(), [], identity()))).toEqual([3, 6, 11]);
  });

  it("generates the correct selections for a linear draft", () => {
    expect(
      overallPicks(buildDraftPickOwnership(draft({ type: "linear" }), [], identity())),
    ).toEqual([3, 7, 11]);
  });

  it("removes traded-away picks and includes acquired picks", () => {
    const trades: SleeperTradedPick[] = [
      { round: 2, originalRosterId: 30, previousOwnerId: 30, ownerId: 20 },
      { round: 2, originalRosterId: 10, previousOwnerId: 10, ownerId: 30 },
    ];

    const owned = buildDraftPickOwnership(draft(), trades, identity());

    expect(overallPicks(owned)).toEqual([3, 8, 11]);
    expect(owned.find((pick) => pick.overallPick === 8)).toMatchObject({
      acquired: true,
      originalRosterId: 10,
      ownerRosterId: 30,
    });
  });

  it("uses live mock-draft page ownership when Sleeper's traded-picks API is empty", () => {
    const mockDraft = draft({
      teams: 10,
      rounds: 18,
      slotToRosterId: Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => [index + 1, (index + 1) * 10]),
      ),
    });
    const keeperPicks = [pickForDraft(mockDraft, 18, true), pickForDraft(mockDraft, 38, true)];
    const snapshot: DraftSnapshot = {
      draft: mockDraft,
      picks: keeperPicks,
      draftedPlayerIds: keeperPicks.map((draftPick) => draftPick.playerId),
      totalPicks: 180,
      currentPick: 3,
      completedPickCount: 2,
      futureKeeperCount: 2,
      tradedPicks: [],
      lastSuccessfulSyncAt: "2026-09-04T12:00:00.000Z",
    };

    const owned = findUpcomingOwnedPicks(snapshot, identity(), 4, {
      ownedPickNumbers: [11, 30],
      tradedPickNumbers: [18, 23],
      keeperPickNumbers: [18],
    });

    expect(overallPicks(owned)).toEqual([3, 11, 30, 43]);
    expect(owned.find((pick) => pick.overallPick === 11)).toMatchObject({
      round: 2,
      pickInRound: 1,
      draftSlot: 10,
      acquired: true,
    });
  });
});

describe("findUpcomingOwnedPicks", () => {
  it("starts at the live pick and skips future keeper-occupied selections", () => {
    const snapshot = snapshotAt(5, [pick(6, true)]);

    expect(overallPicks(findUpcomingOwnedPicks(snapshot, identity()))).toEqual([11]);
  });
});

function draft(overrides: Partial<SleeperDraft> = {}): SleeperDraft {
  return {
    draftId: "12345678",
    name: "Test Draft",
    status: "drafting",
    type: "snake",
    teams: 4,
    rounds: 3,
    draftOrder: { user1: 1, user2: 2, user3: 3, user4: 4 },
    slotToRosterId: { 1: 10, 2: 20, 3: 30, 4: 40 },
    creatorUserIds: ["user1"],
    ...overrides,
  };
}

function user(): SleeperUserIdentity {
  return { userId: "user3", username: "manager3", displayName: "Manager 3" };
}

function identity(): UserDraftIdentity {
  return { user: user(), draftSlot: 3, rosterId: 30, automatic: false };
}

function pick(pickNumber: number, isKeeper = false): SleeperDraftPick {
  return {
    playerId: `player-${pickNumber}`,
    pickNumber,
    round: Math.ceil(pickNumber / 4),
    draftSlot: ((pickNumber - 1) % 4) + 1,
    isKeeper,
  };
}

function pickForDraft(
  selectedDraft: SleeperDraft,
  pickNumber: number,
  isKeeper = false,
): SleeperDraftPick {
  const round = Math.ceil(pickNumber / selectedDraft.teams);
  const pickInRound = ((pickNumber - 1) % selectedDraft.teams) + 1;
  const draftSlot =
    selectedDraft.type === "snake" && round % 2 === 0
      ? selectedDraft.teams - pickInRound + 1
      : pickInRound;
  return {
    playerId: `player-${pickNumber}`,
    pickNumber,
    round,
    draftSlot,
    isKeeper,
  };
}

function snapshotAt(currentPick: number, picks: SleeperDraftPick[]): DraftSnapshot {
  return {
    draft: draft(),
    picks,
    draftedPlayerIds: picks.map((draftPick) => draftPick.playerId),
    totalPicks: 12,
    currentPick,
    completedPickCount: currentPick - 1,
    futureKeeperCount: picks.filter((draftPick) => draftPick.isKeeper).length,
    tradedPicks: [],
    lastSuccessfulSyncAt: "2026-09-04T12:00:00.000Z",
  };
}

function overallPicks(picks: Array<{ overallPick: number }>): number[] {
  return picks.map((pickRecord) => pickRecord.overallPick);
}

import { describe, expect, it } from "vitest";
import { buildTeamRoster } from "../../src/roster/roster-engine";
import type { ImportedPlayer } from "../../src/types/board";
import type {
  DraftRosterSettings,
  DraftSnapshot,
  SleeperDraftPick,
  UserDraftIdentity,
} from "../../src/types/draft";

describe("buildTeamRoster", () => {
  it("fills natural positions before flex and sends an extra quarterback to the bench", () => {
    const roster = buildTeamRoster(
      snapshot(settings({ qb: 1, rb: 1, flex: 1, bench: 2 }), [
        pick(3, "qb-1", "QB"),
        pick(6, "qb-2", "QB"),
        pick(11, "rb-1", "RB"),
        pick(14, "rb-2", "RB"),
      ]),
      identity(),
      [],
    );

    expect(roster.starters.map((slot) => [slot.kind, slot.player?.playerId])).toEqual([
      ["QB", "qb-1"],
      ["RB", "rb-1"],
      ["FLEX", "rb-2"],
    ]);
    expect(roster.bench.map((player) => player.playerId)).toEqual(["qb-2"]);
    expect(roster.displayedBenchSize).toBe(2);
  });

  it("expands the bench when incompatible picks leave a starting position open", () => {
    const roster = buildTeamRoster(
      snapshot(settings({ qb: 1, te: 1, bench: 1 }), [
        pick(3, "qb-1", "QB"),
        pick(6, "qb-2", "QB"),
        pick(11, "qb-3", "QB"),
      ]),
      identity(),
      [],
    );

    expect(roster.starters.find((slot) => slot.kind === "TE")?.player).toBeNull();
    expect(roster.bench).toHaveLength(2);
    expect(roster.configuredBenchSize).toBe(1);
    expect(roster.displayedBenchSize).toBe(2);
  });

  it("includes a future keeper on an owned committed pick and allocates keepers first", () => {
    const keeper = pick(11, "keeper", "TE", true, null);
    const draftedTightEnd = pick(3, "drafted-te", "TE");
    const roster = buildTeamRoster(
      snapshot(settings({ te: 1, bench: 1 }), [draftedTightEnd, keeper]),
      identity(),
      [boardPlayer("keeper", "Keeper Tight End", "TE")],
    );

    expect(roster.starters[0]?.player).toMatchObject({
      playerId: "keeper",
      name: "Keeper Tight End",
      isKeeper: true,
    });
    expect(roster.bench[0]?.playerId).toBe("drafted-te");
  });

  it("uses the current pick schedule even when Sleeper roster IDs describe another owner", () => {
    const mine = pick(3, "mine", "RB", false, "8");
    const theirs = pick(1, "theirs", "RB", false, "3");
    const roster = buildTeamRoster(snapshot(settings({ rb: 1 }), [mine, theirs]), identity(), []);

    expect(roster.ownedPlayerCount).toBe(1);
    expect(roster.starters[0]?.player?.playerId).toBe("mine");
  });

  it("uses current traded-pick ownership for keepers instead of their original roster ID", () => {
    const acquiredKeeper = pick(2, "acquired-keeper", "RB", true, "2");
    const tradedAwayKeeper = pick(3, "traded-away-keeper", "RB", true, "3");
    const roster = buildTeamRoster(
      snapshot(
        settings({ rb: 1, bench: 1 }),
        [acquiredKeeper, tradedAwayKeeper],
        [
          { round: 1, originalRosterId: 2, previousOwnerId: 2, ownerId: 3 },
          { round: 1, originalRosterId: 3, previousOwnerId: 3, ownerId: 4 },
        ],
      ),
      identity(),
      [],
    );

    expect(roster.ownedPlayerCount).toBe(1);
    expect(roster.starters[0]?.player?.playerId).toBe("acquired-keeper");
    expect(roster.bench).toHaveLength(0);
  });

  it("applies visible draft-board ownership when the traded-picks API has no records", () => {
    const acquiredKeeper = pick(2, "page-acquired-keeper", "RB", false, "2");
    const tradedAwayKeeper = pick(3, "page-traded-away-keeper", "RB", false, "3");
    const roster = buildTeamRoster(
      snapshot(settings({ rb: 1, bench: 1 }), [acquiredKeeper, tradedAwayKeeper], [], 1),
      identity(),
      [],
      { ownedPickNumbers: [2], tradedPickNumbers: [3], keeperPickNumbers: [2, 3] },
    );

    expect(roster.ownedPlayerCount).toBe(1);
    expect(roster.starters[0]?.player?.playerId).toBe("page-acquired-keeper");
  });

  it("excludes drafted players from traded-away picks and includes acquired drafted picks", () => {
    const acquiredPlayer = pick(2, "page-acquired-player", "WR", false, "2", "other-user");
    const tradedAwayPlayer = pick(3, "page-traded-away-player", "WR", false, "3", "user3");
    const roster = buildTeamRoster(
      snapshot(settings({ wr: 1, bench: 1 }), [acquiredPlayer, tradedAwayPlayer], [], 4),
      identity(),
      [],
      { ownedPickNumbers: [2], tradedPickNumbers: [3], keeperPickNumbers: [] },
    );

    expect(roster.ownedPlayerCount).toBe(1);
    expect(roster.starters[0]?.player?.playerId).toBe("page-acquired-player");
    expect(roster.bench).toHaveLength(0);
  });
});

function snapshot(
  rosterSettings: DraftRosterSettings,
  picks: SleeperDraftPick[],
  tradedPicks: DraftSnapshot["tradedPicks"] = [],
  currentPick = nextPickAfterNonKeepers(picks),
): DraftSnapshot {
  const rounds = Math.max(3, Math.ceil(Math.max(0, ...picks.map((pick) => pick.pickNumber)) / 4));
  return {
    draft: {
      draftId: "draft-1",
      name: "Test draft",
      status: "drafting",
      type: "snake",
      teams: 4,
      rounds,
      rosterSettings,
      draftOrder: { user3: 3 },
      slotToRosterId: { 1: 1, 2: 2, 3: 3, 4: 4 },
      creatorUserIds: ["user3"],
    },
    picks,
    draftedPlayerIds: picks.map((draftPick) => draftPick.playerId),
    totalPicks: rounds * 4,
    currentPick,
    completedPickCount: picks.filter((pick) => pick.pickNumber < currentPick).length,
    futureKeeperCount: picks.filter((draftPick) => draftPick.isKeeper).length,
    tradedPicks,
    lastSuccessfulSyncAt: "2026-09-05T00:00:00.000Z",
  };
}

function nextPickAfterNonKeepers(picks: SleeperDraftPick[]): number {
  return Math.max(0, ...picks.filter((pick) => !pick.isKeeper).map((pick) => pick.pickNumber)) + 1;
}

function settings(overrides: Partial<DraftRosterSettings>): DraftRosterSettings {
  return {
    qb: 0,
    rb: 0,
    wr: 0,
    te: 0,
    flex: 0,
    receiverFlex: 0,
    superFlex: 0,
    kicker: 0,
    defense: 0,
    bench: 0,
    ...overrides,
  };
}

function pick(
  pickNumber: number,
  playerId: string,
  position: string,
  isKeeper = false,
  rosterId: string | null = "3",
  pickedBy?: string,
): SleeperDraftPick {
  return {
    playerId,
    playerName: playerId,
    position,
    team: "TST",
    pickNumber,
    round: Math.ceil(pickNumber / 4),
    draftSlot: ((pickNumber - 1) % 4) + 1,
    rosterId: rosterId ?? undefined,
    pickedBy,
    isKeeper,
  };
}

function identity(): UserDraftIdentity {
  return {
    user: { userId: "user3", username: "manager", displayName: "Manager" },
    draftSlot: 3,
    rosterId: 3,
    automatic: true,
  };
}

function boardPlayer(
  playerId: string,
  name: string,
  position: "QB" | "RB" | "WR" | "TE",
): ImportedPlayer {
  return {
    boardPlayerId: `${position}:${name}`,
    sleeperPlayerId: playerId,
    sourceRow: 2,
    name,
    normalizedName: name.toLowerCase(),
    position,
    team: "TST",
    sleeperPositionAdp: 1,
    modelPositionRank: 1,
    projectedPositionSos: 1,
    sleeperOverallAdp: 1,
    modelOverallAdp: 1,
    positionEdge: 0,
    overallEdge: 0,
    isTarget: false,
  };
}

import { describe, expect, it } from "vitest";
import { buildTargetRecommendations, calculateTargetAction } from "../../src/targets/target-engine";
import type { ImportedPlayer } from "../../src/types/board";
import type { OwnedDraftPick } from "../../src/types/draft";

describe("buildTargetRecommendations", () => {
  it("sorts matched available targets by model ADP and removes drafted targets", () => {
    const result = buildTargetRecommendations(
      [
        player("Later Target", "later", 40, true),
        player("Drafted Target", "drafted", 10, true),
        player("Next Target", "next", 20, true),
        player("Regular Player", "regular", 5, false),
        player("Unmatched Target", undefined, 15, true),
      ],
      ["drafted"],
      8,
      [ownedPick(18), ownedPick(23), ownedPick(38)],
      10,
    );

    expect(result.availableCount).toBe(2);
    expect(result.players.map(({ player: target }) => target.name)).toEqual([
      "Next Target",
      "Later Target",
    ]);
  });

  it("applies the requested list limit", () => {
    const players = Array.from({ length: 10 }, (_, index) =>
      player(`Target ${index + 1}`, `target-${index + 1}`, index + 1, true),
    );
    expect(buildTargetRecommendations(players, [], 1, [], 3).players).toHaveLength(3);
    expect(buildTargetRecommendations(players, [], 1, [], 5).players).toHaveLength(5);
    expect(buildTargetRecommendations(players, [], 1, [], 10).players).toHaveLength(10);
  });

  it("compresses target value and urgency when higher-ranked players are keeper-assigned", () => {
    const keepers = Array.from({ length: 6 }, (_, index) =>
      player(`Keeper ${index + 1}`, `keeper-${index + 1}`, index + 1, false, index + 1),
    );
    const target = player("Compressed Target", "target", 7, true, 7);
    const laterPlayer = player("Later Player", "later", 8, false, 8);

    const [recommendation] = buildTargetRecommendations(
      [...keepers, target, laterPlayer],
      keepers.map((keeper) => keeper.sleeperPlayerId as string),
      1,
      [ownedPick(3)],
      3,
      0,
      keepers.map((keeper) => keeper.sleeperPlayerId as string),
    ).players;

    expect(recommendation).toMatchObject({
      sleeperExpectedPick: 1,
      countedAtPosition: 6,
      positionTiming: { kind: "value", picks: 0, basis: "position" },
      modelTiming: { kind: "value", picks: 0, basis: "overall" },
      sleeperTiming: { kind: "value", picks: 0, basis: "overall" },
      action: {
        kind: "trade_up",
        earliestApprovedPick: 1,
        sleeperExpectedPick: 1,
        tradeWindowStart: 1,
        tradeWindowEnd: 2,
      },
    });
  });

  it("silently moves targets expected at or beyond the fourth owned pick below nearer targets", () => {
    const marketPlayers = Array.from({ length: 42 }, (_, index) =>
      player(`Market Player ${index + 1}`, `market-${index + 1}`, 100 + index, false, index + 1),
    );
    const farModelFavorite = player("Far Model Favorite", "far", 1, true, 100);
    const nearerTarget = player("Nearer Target", "near", 2, true, 30);

    const result = buildTargetRecommendations(
      [...marketPlayers, farModelFavorite, nearerTarget],
      [],
      2,
      [ownedPick(3), ownedPick(11), ownedPick(30), ownedPick(43)],
      10,
    );

    expect(result.players.map(({ player: target }) => target.name)).toEqual([
      "Nearer Target",
      "Far Model Favorite",
    ]);
    expect(
      result.players.find(({ player: target }) => target.name === "Far Model Favorite"),
    ).toMatchObject({ sleeperExpectedPick: 45 });
  });

  it("keeps model order when fewer than four upcoming owned picks are known", () => {
    const marketPlayers = Array.from({ length: 42 }, (_, index) =>
      player(`Market Player ${index + 1}`, `market-${index + 1}`, 100 + index, false, index + 1),
    );
    const farModelFavorite = player("Far Model Favorite", "far", 1, true, 100);
    const nearerTarget = player("Nearer Target", "near", 2, true, 30);

    const result = buildTargetRecommendations(
      [...marketPlayers, farModelFavorite, nearerTarget],
      [],
      2,
      [ownedPick(3), ownedPick(11), ownedPick(30)],
      10,
    );

    expect(result.players.map(({ player: target }) => target.name)).toEqual([
      "Far Model Favorite",
      "Nearer Target",
    ]);
  });
});

describe("calculateTargetAction", () => {
  const ownedPicks = [ownedPick(23), ownedPick(30), ownedPick(43)];

  it("waits when Sleeper expects the target to survive to the next owned pick", () => {
    expect(calculateTargetAction(20, 25, ownedPicks)).toMatchObject({
      kind: "waiting",
      earliestApprovedPick: 25,
      sleeperExpectedPick: 25,
      nextOwnedPick: { overallPick: 23 },
      tradeWindowStart: null,
      tradeWindowEnd: null,
    });
  });

  it("recommends trading up when the target is at risk inside the Sleeper-based reach window", () => {
    expect(calculateTargetAction(20, 21, ownedPicks)).toMatchObject({
      kind: "trade_up",
      tradeWindowStart: 21,
      tradeWindowEnd: 22,
    });
  });

  it("limits target picks to the reach tolerance through one pick after Sleeper value", () => {
    expect(calculateTargetAction(5, 11, [ownedPick(18)], 6)).toMatchObject({
      kind: "trade_up",
      earliestApprovedPick: 5,
      tradeWindowStart: 5,
      tradeWindowEnd: 12,
    });
  });

  it("clips target picks before the user's next owned selection", () => {
    expect(calculateTargetAction(5, 17, [ownedPick(18)], 6)).toMatchObject({
      kind: "trade_up",
      tradeWindowStart: 11,
      tradeWindowEnd: 17,
    });
  });

  it("targets only the current pick when a player survives beyond the projected window", () => {
    expect(calculateTargetAction(14, 11, [ownedPick(18)], 6)).toMatchObject({
      kind: "trade_up",
      tradeWindowStart: 14,
      tradeWindowEnd: 14,
    });
  });

  it("does not expose target picks when the next owned selection is safe", () => {
    expect(calculateTargetAction(5, 11, [ownedPick(10)], 6)).toMatchObject({
      kind: "waiting",
      tradeWindowStart: null,
      tradeWindowEnd: null,
    });
  });

  it("does not trigger a trade when Sleeper expects the target at the owned pick", () => {
    expect(calculateTargetAction(20, 23, ownedPicks)).toMatchObject({
      kind: "waiting",
      nextOwnedPick: { overallPick: 23 },
    });
  });

  it("recommends drafting when the current owned pick is at Sleeper value", () => {
    expect(calculateTargetAction(30, 30, ownedPicks)).toMatchObject({
      kind: "draft_now",
      nextOwnedPick: { overallPick: 30 },
    });
  });

  it("advances waiting guidance as soon as the current owned pick begins", () => {
    expect(calculateTargetAction(30, 45, [ownedPick(30), ownedPick(43)])).toMatchObject({
      kind: "waiting",
      nextOwnedPick: { overallPick: 43 },
    });
  });

  it("flags a target for consideration when it is too early but unlikely to make it back", () => {
    expect(calculateTargetAction(3, 5, [ownedPick(3), ownedPick(11)])).toMatchObject({
      kind: "consider_now",
      earliestApprovedPick: 5,
      sleeperExpectedPick: 5,
      nextOwnedPick: { overallPick: 11 },
    });
  });

  it("uses reach tolerance against Sleeper value instead of model value", () => {
    expect(calculateTargetAction(23, 25, ownedPicks, 0)).toMatchObject({
      kind: "consider_now",
      earliestApprovedPick: 25,
    });
    expect(calculateTargetAction(23, 25, ownedPicks, 2)).toMatchObject({
      kind: "draft_now",
      earliestApprovedPick: 23,
      sleeperExpectedPick: 25,
    });
  });

  it("withholds ownership guidance until the user roster is known", () => {
    expect(calculateTargetAction(30, 30, null)).toBeNull();
  });
});

function player(
  name: string,
  sleeperPlayerId: string | undefined,
  modelOverallAdp: number,
  isTarget: boolean,
  sleeperOverallAdp = modelOverallAdp + 5,
): ImportedPlayer {
  return {
    boardPlayerId: `RB:${name}`,
    sleeperPlayerId,
    sourceRow: 2,
    name,
    normalizedName: name.toLowerCase(),
    position: "RB",
    team: "TST",
    sleeperPositionAdp: modelOverallAdp,
    modelPositionRank: modelOverallAdp,
    projectedPositionSos: 12,
    sleeperOverallAdp,
    modelOverallAdp,
    positionEdge: 0,
    overallEdge: sleeperOverallAdp - modelOverallAdp,
    isTarget,
  };
}

function ownedPick(overallPick: number): OwnedDraftPick {
  return {
    overallPick,
    round: Math.ceil(overallPick / 10),
    pickInRound: ((overallPick - 1) % 10) + 1,
    draftSlot: 3,
    originalRosterId: 3,
    ownerRosterId: 3,
    acquired: false,
  };
}

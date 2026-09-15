import { describe, expect, it } from "vitest";
import {
  buildRemainingPoolTimings,
  buildPositionRecommendations,
  calculateModelOverallTiming,
  calculateModelPositionTiming,
  calculatePickTiming,
} from "../../src/recommendations/recommendation-engine";
import type { BoardPosition, ImportedPlayer } from "../../src/types/board";

describe("buildPositionRecommendations", () => {
  it("excludes drafted and unmatched players and ranks each position by model position rank", () => {
    const players = [
      player("rb-three", "RB", 3, 30, "rb-three"),
      player("rb-one", "RB", 1, 10, "rb-one"),
      player("rb-two", "RB", 2, 20, "rb-two"),
      player("rb-drafted", "RB", 0, 5, "rb-drafted"),
      player("rb-unmatched", "RB", 0, 4, undefined),
      player("qb-one", "QB", 1, 15, "qb-one"),
    ];

    const groups = buildPositionRecommendations(players, ["rb-drafted"], 12, 2);
    const runningBacks = groups.find((group) => group.position === "RB");
    const quarterbacks = groups.find((group) => group.position === "QB");

    expect(runningBacks?.availableCount).toBe(3);
    expect(runningBacks?.players.map(({ player: recommendation }) => recommendation.name)).toEqual([
      "rb-one",
      "rb-two",
    ]);
    expect(quarterbacks?.players[0]?.player.name).toBe("qb-one");
  });

  it("uses remaining-pool model and Sleeper ranks as separate timing references", () => {
    const [runningBacks] = buildPositionRecommendations(
      [
        player("Model Favorite", "RB", 1, 10, "favorite", 20),
        player("Market Favorite", "WR", 1, 20, "market-favorite", 10),
      ],
      [],
      15,
    ).filter((group) => group.position === "RB");

    expect(runningBacks?.players[0]).toMatchObject({
      sleeperExpectedPick: 16,
      countedAtPosition: 0,
      positionTiming: { kind: "value", picks: 0, basis: "position" },
      modelTiming: { kind: "early", picks: 9, basis: "overall" },
      sleeperTiming: { kind: "early", picks: 5, basis: "overall" },
    });
  });

  it("uses unavailable players at the same position for model value", () => {
    const players = [
      player("Keeper One", "RB", 1, 1, "keeper-1", 1),
      player("Keeper Two", "WR", 1, 2, "keeper-2", 2),
      player("Target", "RB", 2, 7, "target", 7),
      player("Later", "WR", 2, 9, "later", 9),
      player("Late Keeper", "TE", 1, 20, "late-keeper", 20),
    ];

    const timings = buildRemainingPoolTimings(players, ["keeper-1", "keeper-2", "late-keeper"], 1);

    expect(timings.get("RB:Target")).toMatchObject({
      sleeperExpectedPick: 1,
      countedAtPosition: 1,
      positionTiming: { kind: "value", picks: 0, basis: "position" },
    });
    expect(timings.get("WR:Later")).toMatchObject({
      sleeperExpectedPick: 2,
      countedAtPosition: 1,
      positionTiming: { kind: "value", picks: 0, basis: "position" },
    });
  });

  it("gives tied ADPs the same dynamic pick instead of inventing an ordering", () => {
    const players = [
      player("Tie One", "RB", 1, 7, "tie-1", 9),
      player("Tie Two", "WR", 1, 7, "tie-2", 9),
    ];

    const timings = buildRemainingPoolTimings(players, [], 4);

    expect(timings.get("RB:Tie One")?.sleeperExpectedPick).toBe(4);
    expect(timings.get("WR:Tie Two")?.sleeperExpectedPick).toBe(4);
  });

  it("preserves Sleeper draft value created by reaches while adjusting future keepers", () => {
    const bijan = { ...player("Bijan Robinson", "RB", 2, 2, "bijan", 2.8), sleeperOverallRank: 2 };
    const puka = { ...player("Puka Nacua", "WR", 3, 3, "puka", 3.4), sleeperOverallRank: 3 };
    const cook = { ...player("James Cook", "RB", 20, 20, "cook", 20.5), sleeperOverallRank: 20 };
    const gibbs = { ...player("Jahmyr Gibbs", "RB", 1, 1, "gibbs", 1.5), sleeperOverallRank: 1 };
    const taylor = {
      ...player("Jonathan Taylor", "RB", 7, 7, "taylor", 7.1),
      sleeperOverallRank: 7,
    };
    const futureKeepers = [
      { ...player("Christian McCaffrey", "RB", 4, 4, "cmc", 4.6), sleeperOverallRank: 4 },
      { ...player("Ja'Marr Chase", "WR", 5, 5, "chase", 5.2), sleeperOverallRank: 5 },
      { ...player("Jaxon Smith-Njigba", "WR", 6, 6, "jsn", 6.4), sleeperOverallRank: 6 },
    ];
    const futureKeeperIds = futureKeepers.map((keeper) => keeper.sleeperPlayerId as string);
    const timings = buildRemainingPoolTimings(
      [bijan, puka, cook, gibbs, taylor, ...futureKeepers],
      ["bijan", "puka", "cook", ...futureKeeperIds],
      4,
      futureKeeperIds,
    );

    expect(timings.get("RB:Jahmyr Gibbs")).toMatchObject({
      sleeperValuePick: 1,
      sleeperExpectedPick: 4,
      sleeperTiming: { kind: "discount", picks: 3, basis: "overall" },
    });
    expect(timings.get("RB:Jonathan Taylor")).toMatchObject({
      sleeperValuePick: 4,
      sleeperExpectedPick: 5,
      sleeperTiming: { kind: "value", picks: 0, basis: "overall" },
    });
  });

  it("counts future assignments ahead of the best remaining market player", () => {
    const completed = Array.from({ length: 8 }, (_, index) =>
      player(`Completed ${index + 1}`, "WR", index + 1, index + 1, `completed-${index + 1}`),
    );
    const earlyKeeper = player("Early Keeper", "WR", 20, 80, "early-keeper", 25);
    const michaelWilson = player("Michael Wilson", "WR", 30, 150, "michael-wilson", 90);
    const higgins = player("Tee Higgins", "WR", 8, 35, "higgins", 38);
    const flowers = player("Zay Flowers", "WR", 10, 40, "flowers", 41);
    const unavailableIds = [
      ...completed.map((draftedPlayer) => draftedPlayer.sleeperPlayerId as string),
      "early-keeper",
      "michael-wilson",
    ];
    const timings = buildRemainingPoolTimings(
      [...completed, earlyKeeper, michaelWilson, higgins, flowers],
      unavailableIds,
      30,
      ["early-keeper", "michael-wilson"],
    );

    expect(timings.get("WR:Tee Higgins")).toMatchObject({
      countedAtPosition: 9,
      countedOverall: 9,
      positionTiming: { kind: "discount", picks: 2, basis: "position" },
      modelTiming: { kind: "early", picks: 25, basis: "overall" },
    });
    expect(timings.get("WR:Zay Flowers")).toMatchObject({
      countedAtPosition: 9,
      countedOverall: 9,
      positionTiming: { kind: "value", picks: 0, basis: "position" },
      modelTiming: { kind: "early", picks: 30, basis: "overall" },
    });
  });

  it("uses one remaining-market frontier so model order cannot invert", () => {
    const completed = Array.from({ length: 10 }, (_, index) =>
      player(`Completed ${index + 1}`, "WR", index + 1, index + 1, `completed-${index + 1}`),
    );
    const earlyKeeper = player("Early Keeper", "WR", 20, 80, "early-keeper", 15);
    const middleKeeper = player("Middle Keeper", "WR", 21, 81, "middle-keeper", 25);
    const laterKeeper = player("Later Keeper", "WR", 22, 82, "later-keeper", 29);
    const chaseBrown = player("Chase Brown", "RB", 4, 12.5, "chase-brown", 17.2);
    const breeceHall = player("Breece Hall", "RB", 5, 15, "breece-hall", 31.2);
    const keeperIds = ["early-keeper", "middle-keeper", "later-keeper"];
    const timings = buildRemainingPoolTimings(
      [...completed, earlyKeeper, middleKeeper, laterKeeper, chaseBrown, breeceHall],
      [...completed.map((draftedPlayer) => draftedPlayer.sleeperPlayerId as string), ...keeperIds],
      11,
      keeperIds,
    );

    expect(timings.get("RB:Chase Brown")).toMatchObject({
      countedOverall: 11,
      modelTiming: { kind: "early", picks: 0.5, basis: "overall" },
    });
    expect(timings.get("RB:Breece Hall")).toMatchObject({
      countedOverall: 11,
      modelTiming: { kind: "early", picks: 3, basis: "overall" },
    });
  });

  it("shows the top remaining player at model value after elite keeper assignments", () => {
    const keepers = [
      player("Keeper One", "RB", 1, 1, "keeper-1", 1),
      player("Keeper Two", "WR", 1, 2, "keeper-2", 2),
      player("Keeper Three", "WR", 2, 3, "keeper-3", 3),
    ];
    const cmc = player("Christian McCaffrey", "RB", 2, 4, "cmc", 4.5);
    const lateKeeper = player("Late Keeper", "WR", 30, 100, "late-keeper", 90);
    const keeperIds = keepers.map((keeper) => keeper.sleeperPlayerId as string);
    const timings = buildRemainingPoolTimings(
      [...keepers, cmc, lateKeeper],
      [...keeperIds, "late-keeper"],
      1,
      [...keeperIds, "late-keeper"],
    );

    expect(timings.get("RB:Christian McCaffrey")).toMatchObject({
      countedOverall: 3,
      modelTiming: { kind: "value", picks: 0, basis: "overall" },
    });
  });
});

describe("calculateModelPositionTiming", () => {
  it("allows multiple players to be model values at the same pick", () => {
    expect(calculateModelPositionTiming(8, 10)).toEqual({
      kind: "discount",
      picks: 3,
      basis: "position",
    });
    expect(calculateModelPositionTiming(10, 10)).toEqual({
      kind: "discount",
      picks: 1,
      basis: "position",
    });
    expect(calculateModelPositionTiming(12, 10)).toEqual({
      kind: "early",
      picks: 1,
      basis: "position",
    });
  });
});

describe("calculateModelOverallTiming", () => {
  it("reports total draft spots of value from the shared counted pool", () => {
    expect(calculateModelOverallTiming(28, 29)).toEqual({
      kind: "discount",
      picks: 2,
      basis: "overall",
    });
    expect(calculateModelOverallTiming(30, 29)).toEqual({
      kind: "value",
      picks: 0,
      basis: "overall",
    });
  });
});

describe("calculatePickTiming", () => {
  it.each([
    [null, 12, null],
    [12, 12, { kind: "value", picks: 0 }],
    [8, 12.5, { kind: "early", picks: 4.5 }],
    [17, 12.5, { kind: "discount", picks: 4.5 }],
  ])("calculates timing for current pick %s and ADP %s", (currentPick, adp, expected) => {
    expect(calculatePickTiming(currentPick, adp)).toEqual(expected);
  });
});

function player(
  name: string,
  position: BoardPosition,
  modelPositionRank: number,
  modelOverallAdp: number,
  sleeperPlayerId: string | undefined,
  sleeperOverallAdp = modelOverallAdp,
): ImportedPlayer {
  return {
    boardPlayerId: `${position}:${name}`,
    sleeperPlayerId,
    sourceRow: 2,
    name,
    normalizedName: name.toLowerCase(),
    position,
    team: "TST",
    sleeperPositionAdp: modelPositionRank + 1,
    modelPositionRank,
    projectedPositionSos: 12,
    sleeperOverallAdp,
    modelOverallAdp,
    positionEdge: 1,
    overallEdge: sleeperOverallAdp - modelOverallAdp,
    isTarget: false,
  };
}

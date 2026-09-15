import { describe, expect, it } from "vitest";
import { getPlayerAvailability, searchBoardPlayers } from "../../src/search/player-search";
import type { ImportedPlayer } from "../../src/types/board";

describe("searchBoardPlayers", () => {
  const players = [
    player("Justin Jefferson", "jefferson", 12),
    player("Justin Fields", "fields", 90),
    player("Van Jefferson", "van-jefferson", 140),
    player("CeeDee Lamb", "lamb", 10),
    player("D'Andre Swift", "swift", 48),
  ];

  it("matches first names, last names, multiple prefixes, punctuation, and case", () => {
    expect(names(searchBoardPlayers(players, "JUST"))).toEqual([
      "Justin Jefferson",
      "Justin Fields",
    ]);
    expect(names(searchBoardPlayers(players, "jeff"))).toEqual([
      "Justin Jefferson",
      "Van Jefferson",
    ]);
    expect(names(searchBoardPlayers(players, "just jeff"))).toEqual(["Justin Jefferson"]);
    expect(names(searchBoardPlayers(players, "dandre"))).toEqual(["D'Andre Swift"]);
  });

  it("prioritizes available players and then match quality and model ADP", () => {
    const results = searchBoardPlayers(players, "jefferson", ["jefferson"], []);

    expect(results.map(({ player: result, availability }) => [result.name, availability])).toEqual([
      ["Van Jefferson", "available"],
      ["Justin Jefferson", "drafted"],
    ]);
  });

  it("returns at most eight results", () => {
    const manyPlayers = Array.from({ length: 12 }, (_, index) =>
      player(`Player ${index + 1}`, `player-${index + 1}`, index + 1),
    );

    expect(searchBoardPlayers(manyPlayers, "player")).toHaveLength(8);
  });

  it("returns no results for an empty or unrelated query", () => {
    expect(searchBoardPlayers(players, " ")).toEqual([]);
    expect(searchBoardPlayers(players, "mahomes")).toEqual([]);
  });
});

describe("getPlayerAvailability", () => {
  it("distinguishes available, drafted, keeper-assigned, and unmatched players", () => {
    expect(getPlayerAvailability(player("Available", "available", 1), new Set(), new Set())).toBe(
      "available",
    );
    expect(
      getPlayerAvailability(player("Drafted", "drafted", 2), new Set(["drafted"]), new Set()),
    ).toBe("drafted");
    expect(
      getPlayerAvailability(
        player("Keeper", "keeper", 3),
        new Set(["keeper"]),
        new Set(["keeper"]),
      ),
    ).toBe("keeper");
    expect(getPlayerAvailability(player("Unmatched", undefined, 4), new Set(), new Set())).toBe(
      "unmatched",
    );
  });
});

function names(results: ReturnType<typeof searchBoardPlayers>): string[] {
  return results.map(({ player: result }) => result.name);
}

function player(
  name: string,
  sleeperPlayerId: string | undefined,
  modelAdp: number,
): ImportedPlayer {
  return {
    boardPlayerId: `WR:${name.toLowerCase()}`,
    sleeperPlayerId,
    sourceRow: 2,
    name,
    normalizedName: name
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    position: "WR",
    team: "TST",
    sleeperPositionAdp: modelAdp,
    modelPositionRank: modelAdp,
    projectedPositionSos: 12,
    sleeperOverallAdp: modelAdp,
    modelOverallAdp: modelAdp,
    positionEdge: 0,
    overallEdge: 0,
    isTarget: false,
  };
}

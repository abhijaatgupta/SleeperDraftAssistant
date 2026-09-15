import { describe, expect, it } from "vitest";
import { enrichBoardWithSleeperAdp, ModelRankingError } from "../../src/sleeper/adp-enrichment";
import type { ImportedPlayer, StoredBoard } from "../../src/types/board";
import type { SleeperAdpSnapshot } from "../../src/types/sleeper";

describe("enrichBoardWithSleeperAdp", () => {
  it("replaces overall ADP, derives positional ADP from the full Sleeper order, and recalculates edges", () => {
    const board = makeBoard([
      makePlayer("one", "WR", 5, 20, "One Receiver"),
      makePlayer("three", "WR", 2, 10, "Three Receiver"),
    ]);
    const snapshot = makeSnapshot([
      { playerId: "one", position: "WR", fantasyPositions: ["WR"], overallAdp: 3.2 },
      { playerId: "two", position: "WR", fantasyPositions: ["WR"], overallAdp: 8.7 },
      { playerId: "three", position: "WR", fantasyPositions: ["WR"], overallAdp: 12.1 },
    ]);

    const result = enrichBoardWithSleeperAdp(board, snapshot);

    expect(result.updatedCount).toBe(2);
    expect(result.missingPlayerNames).toEqual([]);
    expect(result.board.metadata).toMatchObject({
      sleeperAdpFormat: "half_ppr",
      sleeperAdpSeason: "2026",
      sleeperAdpFetchedAt: "2026-09-07T12:00:00.000Z",
    });
    expect(result.board.players[0]).toMatchObject({
      sleeperOverallAdp: 3.2,
      sleeperOverallRank: 1,
      sleeperPositionAdp: 1,
      overallEdge: -16.8,
      positionEdge: -4,
    });
    expect(result.board.players[1]).toMatchObject({
      sleeperOverallAdp: 12.1,
      sleeperOverallRank: 3,
      sleeperPositionAdp: 3,
      positionEdge: 1,
    });
    expect(result.board.players[1]?.overallEdge).toBeCloseTo(2.1);
  });

  it("retains the saved values and reports matched players absent from the feed", () => {
    const board = makeBoard([makePlayer("missing", "RB", 4, 30, "Missing Runner")]);

    const result = enrichBoardWithSleeperAdp(board, makeSnapshot([]));

    expect(result.updatedCount).toBe(0);
    expect(result.missingPlayerNames).toEqual(["Missing Runner"]);
    expect(result.board.players[0]).toMatchObject({
      sleeperPositionAdp: 99,
      modelPositionRank: 4,
      positionEdge: 95,
      sleeperOverallAdp: 99,
      modelOverallAdp: 30,
      overallEdge: 69,
    });
  });

  it("derives overall model ADP by assigning Sleeper's positional curve to user ranks", () => {
    const board = makeBoard([
      {
        ...makePlayer("wr-four", "WR", 1, 1, "Sleeper WR4"),
        modelPositionRankProvided: true,
        modelOverallAdpProvided: false,
      },
      {
        ...makePlayer("wr-one", "WR", 4, 4, "Sleeper WR1"),
        modelPositionRankProvided: true,
        modelOverallAdpProvided: false,
      },
    ]);
    const snapshot = makeSnapshot([
      { playerId: "wr-one", position: "WR", fantasyPositions: ["WR"], overallAdp: 3 },
      { playerId: "wr-two", position: "WR", fantasyPositions: ["WR"], overallAdp: 5 },
      { playerId: "wr-three", position: "WR", fantasyPositions: ["WR"], overallAdp: 6 },
      { playerId: "wr-four", position: "WR", fantasyPositions: ["WR"], overallAdp: 9 },
    ]);

    const result = enrichBoardWithSleeperAdp(board, snapshot);

    expect(result.board.players[0]?.modelOverallAdp).toBe(3);
    expect(result.board.players[1]?.modelOverallAdp).toBe(9);
  });

  it("derives model positional ranks from expected overall ADP", () => {
    const board = makeBoard([
      {
        ...makePlayer("later", "RB", 99, 20, "Later Runner"),
        modelPositionRankProvided: false,
        modelOverallAdpProvided: true,
      },
      {
        ...makePlayer("earlier", "RB", 99, 10, "Earlier Runner"),
        modelPositionRankProvided: false,
        modelOverallAdpProvided: true,
      },
    ]);
    const snapshot = makeSnapshot([
      { playerId: "earlier", position: "RB", fantasyPositions: ["RB"], overallAdp: 4 },
      { playerId: "later", position: "RB", fantasyPositions: ["RB"], overallAdp: 8 },
    ]);

    const result = enrichBoardWithSleeperAdp(board, snapshot);

    expect(result.board.players.map((player) => player.modelPositionRank)).toEqual([2, 1]);
  });

  it("preserves both user-supplied rankings instead of re-deriving either one", () => {
    const board = makeBoard([
      {
        ...makePlayer("amon-ra", "WR", 1, 7.5, "Amon-Ra St. Brown"),
        modelPositionRankProvided: true,
        modelOverallAdpProvided: true,
      },
    ]);
    const snapshot = makeSnapshot([
      { playerId: "amon-ra", position: "WR", fantasyPositions: ["WR"], overallAdp: 3 },
    ]);

    const result = enrichBoardWithSleeperAdp(board, snapshot);

    expect(result.board.players[0]).toMatchObject({
      modelPositionRank: 1,
      modelOverallAdp: 7.5,
      sleeperPositionAdp: 1,
      sleeperOverallAdp: 3,
      overallEdge: -4.5,
    });
  });

  it("supports positional-only and overall-only players in the same board", () => {
    const board = makeBoard([
      {
        ...makePlayer("wr-two", "WR", 1, 1, "Second Sleeper Receiver"),
        modelPositionRankProvided: true,
        modelOverallAdpProvided: false,
      },
      {
        ...makePlayer("wr-one", "WR", 99, 12, "First Sleeper Receiver"),
        modelPositionRankProvided: false,
        modelOverallAdpProvided: true,
      },
    ]);
    const snapshot = makeSnapshot([
      { playerId: "wr-one", position: "WR", fantasyPositions: ["WR"], overallAdp: 4 },
      { playerId: "wr-two", position: "WR", fantasyPositions: ["WR"], overallAdp: 9 },
    ]);

    const result = enrichBoardWithSleeperAdp(board, snapshot);

    expect(result.board.players[0]).toMatchObject({
      modelPositionRank: 1,
      modelOverallAdp: 4,
    });
    expect(result.board.players[1]).toMatchObject({
      modelPositionRank: 2,
      modelOverallAdp: 12,
    });
  });

  it("rejects a positional-only rank outside the available Sleeper curve", () => {
    const board = makeBoard([
      {
        ...makePlayer("wr-one", "WR", 3, 3, "Only Receiver"),
        modelPositionRankProvided: true,
        modelOverallAdpProvided: false,
      },
    ]);
    const snapshot = makeSnapshot([
      { playerId: "wr-one", position: "WR", fantasyPositions: ["WR"], overallAdp: 4 },
    ]);

    expect(() => enrichBoardWithSleeperAdp(board, snapshot)).toThrow(
      "Only Receiver's WR3 model rank is outside Sleeper's available WR ADP curve.",
    );
  });

  it("rejects duplicate user positional ranks after Sleeper enrichment", () => {
    const board = makeBoard([
      {
        ...makePlayer("one", "WR", 1, 10, "One Receiver"),
        modelPositionRankProvided: true,
        modelOverallAdpProvided: true,
      },
      {
        ...makePlayer("two", "WR", 1, 20, "Two Receiver"),
        modelPositionRankProvided: true,
        modelOverallAdpProvided: true,
      },
    ]);
    const snapshot = makeSnapshot([
      { playerId: "one", position: "WR", fantasyPositions: ["WR"], overallAdp: 3 },
      { playerId: "two", position: "WR", fantasyPositions: ["WR"], overallAdp: 5 },
    ]);

    expect(() => enrichBoardWithSleeperAdp(board, snapshot)).toThrow(ModelRankingError);
  });
});

function makePlayer(
  sleeperPlayerId: string,
  position: ImportedPlayer["position"],
  modelPositionRank: number,
  modelOverallAdp: number,
  name: string,
): ImportedPlayer {
  return {
    boardPlayerId: `${position}:${name.toLowerCase()}`,
    sleeperPlayerId,
    sourceRow: 2,
    name,
    normalizedName: name.toLowerCase(),
    position,
    team: "BUF",
    sleeperPositionAdp: 99,
    modelPositionRank,
    projectedPositionSos: 10,
    sleeperOverallAdp: 99,
    modelOverallAdp,
    positionEdge: 94,
    overallEdge: 99 - modelOverallAdp,
    isTarget: false,
  };
}

function makeBoard(players: ImportedPlayer[]): StoredBoard {
  return {
    boardId: "board:test",
    metadata: {
      boardId: "board:test",
      fileName: "test.xlsx",
      fileHash: "hash",
      importedAt: "2026-09-07T11:00:00.000Z",
      playerCount: players.length,
      targetCount: 0,
      warningCount: 0,
    },
    players,
    warnings: [],
  };
}

function makeSnapshot(players: SleeperAdpSnapshot["players"]): SleeperAdpSnapshot {
  return {
    season: "2026",
    format: "half_ppr",
    fetchedAt: "2026-09-07T12:00:00.000Z",
    players,
  };
}

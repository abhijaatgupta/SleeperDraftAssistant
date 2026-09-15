import { describe, expect, it } from "vitest";
import { matchBoardPlayers } from "../../src/matching/player-matcher";
import type { ImportedPlayer, StoredBoard } from "../../src/types/board";
import type { SleeperPlayer, SleeperPlayerCatalog } from "../../src/types/sleeper";

describe("matchBoardPlayers", () => {
  it("matches provided IDs, exact names, and suffix differences", () => {
    const board = makeBoard([
      boardPlayer("QB:provided", "Provided Player", "QB", { providedSleeperPlayerId: "10" }),
      boardPlayer("WR:amon ra", "Amon-Ra St. Brown", "WR"),
      boardPlayer("RB:walker", "Kenneth Walker III", "RB"),
    ]);
    const catalog = makeCatalog([
      sleeperPlayer("10", "Different API Name", "QB", "BUF"),
      sleeperPlayer("20", "Amon-Ra St. Brown", "WR", "DET"),
      sleeperPlayer("30", "Kenneth Walker", "RB", "KC"),
    ]);

    const result = matchBoardPlayers(board, catalog, new Date("2026-09-04T13:00:00.000Z"));

    expect(result.summary).toMatchObject({
      matchedCount: 3,
      unmatchedCount: 0,
      ambiguousCount: 0,
      invalidProvidedIdCount: 0,
      matchedAt: "2026-09-04T13:00:00.000Z",
    });
    expect(
      result.board.players.map((player) => [player.sleeperPlayerId, player.sleeperMatchMethod]),
    ).toEqual([
      ["10", "provided-id"],
      ["20", "exact-name"],
      ["30", "name-without-suffix"],
    ]);
  });

  it("uses team only to resolve duplicate name candidates", () => {
    const board = makeBoard([boardPlayer("WR:same", "Same Name", "WR", { team: "NYJ" })]);
    const catalog = makeCatalog([
      sleeperPlayer("1", "Same Name", "WR", "NYJ"),
      sleeperPlayer("2", "Same Name", "WR", "BUF"),
    ]);

    const result = matchBoardPlayers(board, catalog);

    expect(result.board.players[0]?.sleeperPlayerId).toBe("1");
    expect(result.summary.matchedCount).toBe(1);
  });

  it("matches by name alone and hydrates missing position and team", () => {
    const board = makeBoard([
      boardPlayer("PLAYER:unique player", "Unique Player", "WR", {
        sourcePositionProvided: false,
        team: "",
      }),
    ]);
    const catalog = makeCatalog([sleeperPlayer("55", "Unique Player", "RB", "SEA")]);

    const result = matchBoardPlayers(board, catalog);

    expect(result.board.players[0]).toMatchObject({
      boardPlayerId: "RB:unique player",
      sleeperPlayerId: "55",
      position: "RB",
      team: "SEA",
    });
  });

  it("reports ambiguous, unmatched, and invalid provided IDs without guessing", () => {
    const board = makeBoard([
      boardPlayer("WR:ambiguous", "Same Name", "WR", { team: "DAL" }),
      boardPlayer("TE:missing", "Missing Player", "TE"),
      boardPlayer("RB:invalid", "Invalid ID", "RB", { providedSleeperPlayerId: "missing" }),
    ]);
    const catalog = makeCatalog([
      sleeperPlayer("1", "Same Name", "WR", "NYJ"),
      sleeperPlayer("2", "Same Name", "WR", "BUF"),
    ]);

    const result = matchBoardPlayers(board, catalog);

    expect(result.summary).toMatchObject({
      matchedCount: 0,
      unmatchedCount: 1,
      ambiguousCount: 1,
      invalidProvidedIdCount: 1,
    });
    expect(result.summary.issues.map((issue) => issue.kind)).toEqual([
      "ambiguous",
      "unmatched",
      "invalid-provided-id",
    ]);
    expect(result.summary.issues[0]?.candidates).toHaveLength(2);
  });
});

function boardPlayer(
  boardPlayerId: string,
  name: string,
  position: ImportedPlayer["position"],
  overrides: Partial<ImportedPlayer> = {},
): ImportedPlayer {
  return {
    boardPlayerId,
    sourceRow: 5,
    name,
    normalizedName: name.toLowerCase().replace(/[.-]/g, " ").replace(/\s+/g, " ").trim(),
    position,
    team: "DET",
    sleeperPositionAdp: 1,
    modelPositionRank: 1,
    projectedPositionSos: 1,
    sleeperOverallAdp: 1,
    modelOverallAdp: 1,
    positionEdge: 0,
    overallEdge: 0,
    isTarget: false,
    ...overrides,
  };
}

function sleeperPlayer(
  playerId: string,
  name: string,
  position: SleeperPlayer["position"],
  team: string,
): SleeperPlayer {
  return {
    playerId,
    name,
    normalizedName: name.toLowerCase().replace(/[.-]/g, " ").replace(/\s+/g, " ").trim(),
    position,
    fantasyPositions: [position],
    team,
    active: true,
  };
}

function makeBoard(players: ImportedPlayer[]): StoredBoard {
  return {
    boardId: "board:test",
    metadata: {
      boardId: "board:test",
      fileName: "test.xlsx",
      fileHash: "test",
      importedAt: "2026-09-04T12:00:00.000Z",
      playerCount: players.length,
      targetCount: 0,
      warningCount: 0,
    },
    players,
    warnings: [],
  };
}

function makeCatalog(players: SleeperPlayer[]): SleeperPlayerCatalog {
  return {
    catalogId: "nfl-active-offense",
    fetchedAt: "2026-09-04T12:00:00.000Z",
    expiresAt: "2026-09-05T12:00:00.000Z",
    players,
  };
}

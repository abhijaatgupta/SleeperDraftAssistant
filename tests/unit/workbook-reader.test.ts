import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { readDraftBoardWorkbook } from "../../src/import/workbook-reader";
import type { BoardImportError } from "../../src/import/workbook-reader";

const HEADERS = [
  "Player",
  "Current Pos ADP",
  "Model Pos Rank",
  "Projected Pos SOS",
  "Sleeper Overall ADP",
  "Expected Overall ADP",
  "Pos",
  "Team",
  "targets",
  "Sleeper Player ID",
];

describe("readDraftBoardWorkbook", () => {
  it("finds the header, normalizes players, and ignores workbook Sleeper ADP", async () => {
    const bytes = createWorkbook([
      ["Draft Board", null],
      ["Generated", "fixture"],
      [],
      HEADERS,
      ["Bijan Robinson", 2, 1, 8, 4.5, 2.25, "RB", "atl", "draft priority", "9509"],
      ["Amon-Ra St. Brown", 4, 6, 15, 8, 12.5, "WR", "det", null, null],
      ["Team Defense", 1, 1, 1, 1, 1, "DST", "BUF", null, null],
    ]);

    const result = await readDraftBoardWorkbook(
      bytes,
      "fixture.xlsx",
      new Date("2026-09-04T12:00:00.000Z"),
    );

    expect(result.board.metadata).toMatchObject({
      fileName: "fixture.xlsx",
      importedAt: "2026-09-04T12:00:00.000Z",
      playerCount: 2,
      targetCount: 1,
      warningCount: 1,
    });
    expect(result.board.boardId).toMatch(/^board:[a-f0-9]{24}$/);
    expect(result.board.players[0]).toMatchObject({
      boardPlayerId: "RB:bijan robinson",
      sleeperPlayerId: "9509",
      sourceRow: 5,
      name: "Bijan Robinson",
      normalizedName: "bijan robinson",
      position: "RB",
      team: "ATL",
      sleeperPositionAdp: 1,
      modelPositionRank: 1,
      positionEdge: 0,
      sleeperOverallAdp: 2.25,
      modelOverallAdp: 2.25,
      overallEdge: 0,
      isTarget: true,
    });
    expect(result.board.metadata.rankingLabel).toBe("Model");
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: "ignored-position", row: 7 }),
    ]);
  });

  it("defaults targets to false when the optional target column is absent", async () => {
    const headers = HEADERS.filter((header) => header !== "targets");
    const bytes = createWorkbook([headers, ["Josh Allen", 1, 1, 11, 22, 18, "QB", "BUF", "4984"]]);

    const result = await readDraftBoardWorkbook(bytes, "no-targets.xlsx");

    expect(result.board.players[0]?.isTarget).toBe(false);
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: "missing-target-column", row: 1 }),
    ]);
  });

  it("imports without Sleeper ADP columns and seeds safe values until live ADP is loaded", async () => {
    const headers = HEADERS.filter(
      (header) => header !== "Current Pos ADP" && header !== "Sleeper Overall ADP",
    );
    const bytes = createWorkbook([
      headers,
      ["Josh Allen", 1, 11, 18, "QB", "BUF", "target", "4984"],
    ]);

    const result = await readDraftBoardWorkbook(bytes, "live-adp.xlsx");

    expect(result.board.players[0]).toMatchObject({
      sleeperPositionAdp: 1,
      modelPositionRank: 1,
      sleeperOverallAdp: 18,
      modelOverallAdp: 18,
      positionEdge: 0,
      overallEdge: 0,
    });
  });

  it("imports without Projected Pos SOS", async () => {
    const headers = HEADERS.filter(
      (header) =>
        header !== "Current Pos ADP" &&
        header !== "Sleeper Overall ADP" &&
        header !== "Projected Pos SOS",
    );
    const bytes = createWorkbook([headers, ["Josh Allen", 1, 18, "QB", "BUF", "target", "4984"]]);

    const result = await readDraftBoardWorkbook(bytes, "no-sos.xlsx");

    expect(result.board.players[0]).not.toHaveProperty("projectedPositionSos");
    expect(result.warnings).toEqual([]);
  });

  it("accepts Player plus only Model Pos Rank without position or team", async () => {
    const bytes = createWorkbook([
      ["Player", "Model Pos Rank", "Targets"],
      ["Amon-Ra St. Brown", 1, "target"],
    ]);

    const result = await readDraftBoardWorkbook(bytes, "position-ranks.xlsx");

    expect(result.board.players[0]).toMatchObject({
      boardPlayerId: "PLAYER:amon ra st brown",
      name: "Amon-Ra St. Brown",
      position: "WR",
      team: "",
      sourcePositionProvided: false,
      modelPositionRank: 1,
      modelPositionRankProvided: true,
      modelOverallAdpProvided: false,
      isTarget: true,
    });
  });

  it("accepts the reduced workbook's User Pos Rank alias and ignores Expected Half-PPR", async () => {
    const bytes = createWorkbook([
      ["Draft Status", "Player", "Targets", "User Pos Rank", "Expected Half-PPR"],
      [null, "Jahmyr Gibbs", null, 1, 286.96],
      [null, "Bijan Robinson", "priority", 2, 282.64],
    ]);

    const result = await readDraftBoardWorkbook(bytes, "reduced-fields.xlsx");

    expect(result.board.players).toEqual([
      expect.objectContaining({
        name: "Jahmyr Gibbs",
        modelPositionRank: 1,
        modelOverallAdp: 1,
        modelPositionRankProvided: true,
        modelOverallAdpProvided: false,
        sourcePositionProvided: false,
        isTarget: false,
      }),
      expect.objectContaining({
        name: "Bijan Robinson",
        modelPositionRank: 2,
        modelOverallAdp: 2,
        modelPositionRankProvided: true,
        modelOverallAdpProvided: false,
        sourcePositionProvided: false,
        isTarget: true,
      }),
    ]);
    expect(result.board.metadata.rankingLabel).toBe("User");
  });

  it("prefers Model terminology and values when both positional-rank headers exist", async () => {
    const bytes = createWorkbook([
      ["Player", "User Pos Rank", "Model Pos Rank", "Targets"],
      ["Jahmyr Gibbs", 9, 1, null],
    ]);

    const result = await readDraftBoardWorkbook(bytes, "both-position-ranks.xlsx");

    expect(result.board.players[0]?.modelPositionRank).toBe(1);
    expect(result.board.metadata.rankingLabel).toBe("Model");
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "duplicate-column" }));
  });

  it("does not mistake projection-point columns for a model draft ranking", async () => {
    const bytes = createWorkbook([
      ["Player", "Expected Half-PPR"],
      ["Jahmyr Gibbs", 286.96],
    ]);

    await expect(readDraftBoardWorkbook(bytes, "projection-only.xlsx")).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "missing-model-ranking" })],
    });
  });

  it("accepts Player plus only Expected Overall ADP", async () => {
    const bytes = createWorkbook([
      ["Player", "Expected Overall ADP"],
      ["Josh Allen", 18.5],
    ]);

    const result = await readDraftBoardWorkbook(bytes, "overall-ranks.xlsx");

    expect(result.board.players[0]).toMatchObject({
      modelOverallAdp: 18.5,
      modelPositionRankProvided: false,
      modelOverallAdpProvided: true,
    });
  });

  it("supports different ranking inputs on different player rows", async () => {
    const bytes = createWorkbook([
      ["Player", "User Pos Rank", "Expected Overall ADP"],
      ["Amon-Ra St. Brown", 1, null],
      ["Josh Allen", null, 18.5],
      ["Bijan Robinson", 2, 4.25],
    ]);

    const result = await readDraftBoardWorkbook(bytes, "mixed-rankings.xlsx");

    expect(result.board.players).toEqual([
      expect.objectContaining({
        modelPositionRankProvided: true,
        modelOverallAdpProvided: false,
      }),
      expect.objectContaining({
        modelPositionRankProvided: false,
        modelOverallAdpProvided: true,
      }),
      expect.objectContaining({
        modelPositionRankProvided: true,
        modelOverallAdpProvided: true,
      }),
    ]);
  });

  it("rejects an individual player row when both model rankings are blank", async () => {
    const bytes = createWorkbook([
      ["Player", "User Pos Rank", "Expected Overall ADP", "Targets"],
      ["Amon-Ra St. Brown", 1, null, null],
      ["Josh Allen", null, null, null],
    ]);

    await expect(readDraftBoardWorkbook(bytes, "blank-player-ranking.xlsx")).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "missing-model-ranking", row: 3 })],
    });
  });

  it("requires at least one model ranking column", async () => {
    const bytes = createWorkbook([
      ["Player", "Targets"],
      ["Josh Allen", "target"],
    ]);

    await expect(readDraftBoardWorkbook(bytes, "no-rankings.xlsx")).rejects.toMatchObject({
      issues: [
        expect.objectContaining({
          code: "missing-model-ranking",
          message: "Include Model/User Pos Rank, Expected Overall ADP, or both.",
        }),
      ],
    });
  });

  it("rejects a workbook without a Player header", async () => {
    const headers = HEADERS.filter((header) => header !== "Player");
    const bytes = createWorkbook([headers, [1, 1, 11, 22, 18, "QB", "BUF", false, "4984"]]);

    await expect(readDraftBoardWorkbook(bytes, "invalid.xlsx")).rejects.toMatchObject({
      name: "BoardImportError",
      issues: [expect.objectContaining({ code: "missing-header" })],
    } satisfies Partial<BoardImportError>);
  });

  it("rejects duplicate player identities instead of silently overwriting", async () => {
    const bytes = createWorkbook([
      HEADERS,
      ["D.J. Moore", 14, 12, 8, 31, 28, "WR", "CHI", false, null],
      ["DJ Moore", 15, 13, 8, 32, 29, "WR", "CHI", false, null],
    ]);

    await expect(readDraftBoardWorkbook(bytes, "duplicates.xlsx")).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: "duplicate-player", row: 3 })],
    });
  });
});

function createWorkbook(rows: unknown[][]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Draft Board");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

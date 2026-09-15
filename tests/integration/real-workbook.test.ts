import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { normalizeHeader } from "../../src/import/board-schema";
import { normalizePlayerName } from "../../src/import/normalize-player-name";
import { readDraftBoardWorkbook } from "../../src/import/workbook-reader";
import { matchBoardPlayers } from "../../src/matching/player-matcher";
import { enrichBoardWithSleeperAdp } from "../../src/sleeper/adp-enrichment";
import type { BoardPosition, ImportedPlayer } from "../../src/types/board";
import { SLEEPER_CATALOG_ID, type SleeperPlayerCatalog } from "../../src/types/sleeper";

const genericFixturePath = process.env.DRAFT_BOARD_FIXTURE;
const reducedFixturePath = process.env.DRAFT_BOARD_REDUCED_FIXTURE;
const fullFixturePath = process.env.DRAFT_BOARD_FULL_FIXTURE;
const runGenericFixtureTest = genericFixturePath ? it : it.skip;
const runPairedFixtureTest = reducedFixturePath && fullFixturePath ? it : it.skip;

describe("real draft-board workbook", () => {
  runGenericFixtureTest(
    "imports a configured workbook without historical row assumptions",
    async () => {
      const imported = await importFixture(genericFixturePath!);

      expect(imported.board.metadata.playerCount).toBeGreaterThan(0);
      expect(imported.board.players).toHaveLength(imported.board.metadata.playerCount);
      expect(imported.board.metadata.targetCount).toBe(
        imported.board.players.filter((player) => player.isTarget).length,
      );
      expect(imported.board.players.every((player) => player.name.trim().length > 0)).toBe(true);
    },
  );

  runPairedFixtureTest(
    "imports the reduced workbook using Player and User Pos Rank only",
    async () => {
      const imported = await importFixture(reducedFixturePath!);

      expect(imported.board.metadata).toMatchObject({
        playerCount: 252,
        targetCount: 0,
        rankingLabel: "User",
      });
      expect(
        imported.board.players.every((player) => player.sourcePositionProvided === false),
      ).toBe(true);
      expect(imported.board.players.every((player) => player.team === "")).toBe(true);
      expect(
        imported.board.players.every(
          (player) =>
            player.modelPositionRankProvided === true && player.modelOverallAdpProvided === false,
        ),
      ).toBe(true);
      expect(imported.board.players.find((player) => player.name === "Jahmyr Gibbs")).toMatchObject(
        {
          modelPositionRank: 1,
        },
      );
      expect(imported.warnings).toEqual([]);
    },
  );

  runPairedFixtureTest("imports v33 while ignoring its legacy Sleeper ADP columns", async () => {
    const imported = await importFixture(fullFixturePath!);
    const rawRows = await readFullFixtureRows(fullFixturePath!);
    const staleRow = rawRows.find(
      (row) => Number(row["Sleeper Overall ADP"]) !== Number(row["Expected Overall ADP"]),
    );

    expect(imported.board.metadata).toMatchObject({ playerCount: 252, rankingLabel: "Model" });
    expect(imported.board.players.every((player) => player.sourcePositionProvided === true)).toBe(
      true,
    );
    expect(
      imported.board.players.every(
        (player) =>
          player.modelPositionRankProvided === true && player.modelOverallAdpProvided === true,
      ),
    ).toBe(true);
    expect(staleRow).toBeDefined();

    const importedStalePlayer = imported.board.players.find(
      (player) => player.normalizedName === normalizePlayerName(String(staleRow?.Player)),
    );
    expect(importedStalePlayer?.sleeperOverallAdp).toBe(Number(staleRow?.["Expected Overall ADP"]));
    expect(importedStalePlayer?.sleeperOverallAdp).not.toBe(
      Number(staleRow?.["Sleeper Overall ADP"]),
    );
  });

  runPairedFixtureTest(
    "hydrates and derives the reduced workbook offline from v33 player and ADP data",
    async () => {
      const [reduced, full, rawRows] = await Promise.all([
        importFixture(reducedFixturePath!),
        importFixture(fullFixturePath!),
        readFullFixtureRows(fullFixturePath!),
      ]);
      const catalog = createCatalog(full.board.players);
      const matched = matchBoardPlayers(reduced.board, catalog, new Date("2026-09-07T12:00:00Z"));
      const rawByName = new Map(
        rawRows.map((row) => [normalizePlayerName(String(row.Player)), row]),
      );
      const suppliedAdps = rawRows
        .map((row) => Number(row["Sleeper Overall ADP"]))
        .filter((value) => Number.isFinite(value) && value > 0);
      const tailAdpStart = Math.ceil(Math.max(...suppliedAdps)) + 1;
      const snapshotPlayers = catalog.players.map((player, index) => {
        const row = rawByName.get(player.normalizedName);
        const overallAdp = Number(row?.["Sleeper Overall ADP"]);
        return {
          playerId: player.playerId,
          position: player.position,
          fantasyPositions: player.fantasyPositions,
          overallAdp:
            Number.isFinite(overallAdp) && overallAdp > 0 ? overallAdp : tailAdpStart + index,
        };
      });
      let placeholderIndex = 0;
      for (const position of ["QB", "RB", "WR", "TE"] satisfies BoardPosition[]) {
        const requiredCurveSize = Math.max(
          ...matched.board.players
            .filter((player) => player.position === position)
            .map((player) => player.modelPositionRank),
        );
        const existingCurveSize = snapshotPlayers.filter(
          (player) => player.position === position,
        ).length;
        for (let rank = existingCurveSize + 1; rank <= requiredCurveSize; rank += 1) {
          placeholderIndex += 1;
          snapshotPlayers.push({
            playerId: `unranked-${position.toLowerCase()}-${rank}`,
            position,
            fantasyPositions: [position],
            overallAdp: tailAdpStart + catalog.players.length + placeholderIndex,
          });
        }
      }
      const enriched = enrichBoardWithSleeperAdp(matched.board, {
        season: "2026",
        format: "half_ppr",
        fetchedAt: "2026-09-07T12:00:00.000Z",
        players: snapshotPlayers,
      });

      expect(matched.summary).toMatchObject({
        matchedCount: 252,
        unmatchedCount: 0,
        ambiguousCount: 0,
      });
      expect(enriched.updatedCount).toBe(252);
      expect(enriched.missingPlayerNames).toEqual([]);
      expect(
        enriched.board.players.every(
          (player) =>
            player.team.length > 0 &&
            player.modelOverallAdpProvided === false &&
            player.modelOverallAdp > 0 &&
            player.sleeperOverallAdp > 0,
        ),
      ).toBe(true);

      for (const position of ["QB", "RB", "WR", "TE"] satisfies BoardPosition[]) {
        const positionPlayers = enriched.board.players.filter(
          (player) => player.position === position,
        );
        expect(new Set(positionPlayers.map((player) => player.modelPositionRank)).size).toBe(
          positionPlayers.length,
        );
      }
    },
  );
});

async function importFixture(path: string) {
  const bytes = await readFile(path);
  return readDraftBoardWorkbook(Uint8Array.from(bytes).buffer, basename(path));
}

async function readFullFixtureRows(path: string): Promise<Record<string, unknown>[]> {
  const bytes = await readFile(path);
  const workbook = XLSX.read(Uint8Array.from(bytes).buffer, { type: "array", raw: true });
  const sheet = workbook.Sheets["Draft Board"];
  if (!sheet) {
    throw new Error("The full fixture is missing its Draft Board worksheet.");
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeHeader(cell) === "player"),
  );
  if (headerIndex < 0) {
    throw new Error("The full fixture is missing its Player header.");
  }

  const headers = rows[headerIndex].map((value) => String(value ?? "").trim());
  return rows.slice(headerIndex + 1).flatMap((row) => {
    const playerIndex = headers.indexOf("Player");
    if (!String(row[playerIndex] ?? "").trim()) {
      return [];
    }
    return [Object.fromEntries(headers.map((header, index) => [header, row[index]]))];
  });
}

function createCatalog(players: ImportedPlayer[]): SleeperPlayerCatalog {
  return {
    catalogId: SLEEPER_CATALOG_ID,
    fetchedAt: "2026-09-07T11:00:00.000Z",
    expiresAt: "2026-09-08T11:00:00.000Z",
    players: players.map((player, index) => ({
      playerId: `fixture-${index + 1}`,
      name: player.name,
      normalizedName: player.normalizedName,
      position: player.position,
      fantasyPositions: [player.position],
      team: player.team,
      active: true,
    })),
  };
}

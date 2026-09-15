import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { describe, expect, it } from "vitest";
import { readDraftBoardWorkbook } from "../../src/import/workbook-reader";
import { matchBoardPlayers } from "../../src/matching/player-matcher";
import { fetchSleeperPlayerCatalog } from "../../src/sleeper/player-api";

const fixturePath = process.env.DRAFT_BOARD_FIXTURE;
const liveTestEnabled = process.env.SLEEPER_LIVE_TEST === "1" && fixturePath;
const runLiveTest = liveTestEnabled ? it : it.skip;

describe("live Sleeper player matching", () => {
  runLiveTest("matches the configured board against the current Sleeper catalog", async () => {
    const bytes = await readFile(fixturePath!);
    const workbookBytes = Uint8Array.from(bytes).buffer as ArrayBuffer;
    const imported = await readDraftBoardWorkbook(workbookBytes, basename(fixturePath!));
    const catalog = await fetchSleeperPlayerCatalog();
    const result = matchBoardPlayers(imported.board, catalog);

    console.info(JSON.stringify(result.summary, null, 2));
    expect(result.summary.matchedCount).toBeGreaterThanOrEqual(210);
    expect(
      result.board.players.filter((player) => player.isTarget && player.sleeperPlayerId),
    ).toHaveLength(2);
  });
});

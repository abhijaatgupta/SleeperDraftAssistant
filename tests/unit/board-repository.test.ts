import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";
import { BoardRepository } from "../../src/storage/board-repository";
import type { StoredBoard } from "../../src/types/board";

const repositories: Array<{ name: string; repository: BoardRepository }> = [];

afterEach(async () => {
  for (const { name, repository } of repositories.splice(0)) {
    await repository.close();
    await deleteDB(name);
  }
});

describe("BoardRepository", () => {
  it("stores and replaces the active board transactionally", async () => {
    const { repository } = createRepository();
    const first = createBoard("board:first", "first.xlsx");
    const second = createBoard("board:second", "second.xlsx");

    await repository.replaceActiveBoard(first);
    expect(await repository.getActiveBoard()).toEqual(first);

    await repository.replaceActiveBoard(second);
    expect(await repository.getActiveBoard()).toEqual(second);
  });

  it("returns no board or file handle before setup", async () => {
    const { repository } = createRepository();

    expect(await repository.getActiveBoard()).toBeNull();
    expect(await repository.getFileHandle("missing")).toBeNull();
  });
});

function createRepository(): { name: string; repository: BoardRepository } {
  const name = `draft-assistant-test-${crypto.randomUUID()}`;
  const repository = new BoardRepository(name);
  repositories.push({ name, repository });
  return { name, repository };
}

function createBoard(boardId: string, fileName: string): StoredBoard {
  return {
    boardId,
    metadata: {
      boardId,
      fileName,
      fileHash: boardId,
      importedAt: "2026-09-04T12:00:00.000Z",
      playerCount: 0,
      targetCount: 0,
      warningCount: 0,
    },
    players: [],
    warnings: [],
  };
}

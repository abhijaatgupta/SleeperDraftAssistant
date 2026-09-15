import type { IDBPDatabase } from "idb";
import { openDraftAssistantDatabase, type DraftAssistantDatabase } from "./database";
import type { StoredBoard } from "../types/board";

const ACTIVE_BOARD_KEY = "activeBoardId";

export class BoardRepository {
  private databasePromise: Promise<IDBPDatabase<DraftAssistantDatabase>>;

  constructor(databaseName?: string) {
    this.databasePromise = openDraftAssistantDatabase(databaseName);
  }

  async replaceActiveBoard(board: StoredBoard, handle?: FileSystemFileHandle): Promise<void> {
    const database = await this.databasePromise;
    const transaction = database.transaction(["boards", "settings", "fileHandles"], "readwrite");

    await transaction.objectStore("boards").put(board);
    await transaction.objectStore("settings").put({
      key: ACTIVE_BOARD_KEY,
      value: board.boardId,
    });

    if (handle) {
      await transaction.objectStore("fileHandles").put({ boardId: board.boardId, handle });
    } else {
      await transaction.objectStore("fileHandles").delete(board.boardId);
    }

    await transaction.done;
  }

  async getActiveBoard(): Promise<StoredBoard | null> {
    const database = await this.databasePromise;
    const activeBoardSetting = await database.get("settings", ACTIVE_BOARD_KEY);

    if (!activeBoardSetting) {
      return null;
    }

    return (await database.get("boards", activeBoardSetting.value)) ?? null;
  }

  async getFileHandle(boardId: string): Promise<FileSystemFileHandle | null> {
    const database = await this.databasePromise;
    return (await database.get("fileHandles", boardId))?.handle ?? null;
  }

  async saveBoard(board: StoredBoard): Promise<void> {
    const database = await this.databasePromise;
    await database.put("boards", board);
  }

  async close(): Promise<void> {
    const database = await this.databasePromise;
    database.close();
  }
}

export const boardRepository = new BoardRepository();

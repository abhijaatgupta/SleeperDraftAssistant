import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { StoredBoard } from "../types/board";
import type { SleeperPlayerCatalog } from "../types/sleeper";

export const DATABASE_NAME = "sleeper-draft-assistant";
const DATABASE_VERSION = 2;

export interface SettingRecord {
  key: string;
  value: string;
}

export interface FileHandleRecord {
  boardId: string;
  handle: FileSystemFileHandle;
}

export interface DraftAssistantDatabase extends DBSchema {
  boards: {
    key: string;
    value: StoredBoard;
  };
  settings: {
    key: string;
    value: SettingRecord;
  };
  fileHandles: {
    key: string;
    value: FileHandleRecord;
  };
  playerCatalogs: {
    key: string;
    value: SleeperPlayerCatalog;
  };
}

export function openDraftAssistantDatabase(
  databaseName = DATABASE_NAME,
): Promise<IDBPDatabase<DraftAssistantDatabase>> {
  return openDB<DraftAssistantDatabase>(databaseName, DATABASE_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore("boards", { keyPath: "boardId" });
        database.createObjectStore("settings", { keyPath: "key" });
        database.createObjectStore("fileHandles", { keyPath: "boardId" });
      }

      if (oldVersion < 2) {
        database.createObjectStore("playerCatalogs", { keyPath: "catalogId" });
      }
    },
  });
}

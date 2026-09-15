import type { IDBPDatabase } from "idb";
import { openDraftAssistantDatabase, type DraftAssistantDatabase } from "./database";
import { SLEEPER_CATALOG_ID, type SleeperPlayerCatalog } from "../types/sleeper";

export class PlayerCatalogRepository {
  private databasePromise: Promise<IDBPDatabase<DraftAssistantDatabase>>;

  constructor(databaseName?: string) {
    this.databasePromise = openDraftAssistantDatabase(databaseName);
  }

  async getCatalog(): Promise<SleeperPlayerCatalog | null> {
    const database = await this.databasePromise;
    return (await database.get("playerCatalogs", SLEEPER_CATALOG_ID)) ?? null;
  }

  async saveCatalog(catalog: SleeperPlayerCatalog): Promise<void> {
    const database = await this.databasePromise;
    await database.put("playerCatalogs", catalog);
  }

  async close(): Promise<void> {
    const database = await this.databasePromise;
    database.close();
  }
}

export const playerCatalogRepository = new PlayerCatalogRepository();

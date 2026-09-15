import { deleteDB, openDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";
import { PlayerCatalogRepository } from "../../src/storage/player-catalog-repository";
import type { SleeperPlayerCatalog } from "../../src/types/sleeper";

const repositories: Array<{ name: string; repository: PlayerCatalogRepository }> = [];

afterEach(async () => {
  for (const { name, repository } of repositories.splice(0)) {
    await repository.close();
    await deleteDB(name);
  }
});

describe("PlayerCatalogRepository", () => {
  it("persists the normalized Sleeper catalog", async () => {
    const name = `player-catalog-test-${crypto.randomUUID()}`;
    const repository = new PlayerCatalogRepository(name);
    repositories.push({ name, repository });
    const catalog: SleeperPlayerCatalog = {
      catalogId: "nfl-active-offense",
      fetchedAt: "2026-09-04T12:00:00.000Z",
      expiresAt: "2026-09-05T12:00:00.000Z",
      players: [],
    };

    expect(await repository.getCatalog()).toBeNull();
    await repository.saveCatalog(catalog);
    expect(await repository.getCatalog()).toEqual(catalog);
  });

  it("upgrades a Phase 2 database without replacing its existing stores", async () => {
    const name = `player-catalog-migration-test-${crypto.randomUUID()}`;
    const legacyDatabase = await openDB(name, 1, {
      upgrade(database) {
        database.createObjectStore("boards", { keyPath: "boardId" });
        database.createObjectStore("settings", { keyPath: "key" });
        database.createObjectStore("fileHandles", { keyPath: "boardId" });
      },
    });
    legacyDatabase.close();

    const repository = new PlayerCatalogRepository(name);
    repositories.push({ name, repository });
    const catalog: SleeperPlayerCatalog = {
      catalogId: "nfl-active-offense",
      fetchedAt: "2026-09-04T12:00:00.000Z",
      expiresAt: "2026-09-05T12:00:00.000Z",
      players: [],
    };

    await repository.saveCatalog(catalog);
    expect(await repository.getCatalog()).toEqual(catalog);
  });
});

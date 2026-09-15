import { describe, expect, it, vi } from "vitest";
import {
  PlayerCatalogService,
  type PlayerCatalogStore,
} from "../../src/sleeper/player-catalog-service";
import type { SleeperPlayerCatalog } from "../../src/types/sleeper";

describe("PlayerCatalogService", () => {
  it("returns an unexpired catalog without using the network", async () => {
    const catalog = makeCatalog("2026-09-05T12:00:00.000Z");
    const store = makeStore(catalog);
    const fetchCatalog = vi.fn();
    const service = new PlayerCatalogService(store, fetchCatalog);

    const result = await service.load(new Date("2026-09-04T13:00:00.000Z"));

    expect(result).toEqual({ catalog, source: "cache" });
    expect(fetchCatalog).not.toHaveBeenCalled();
  });

  it("refreshes an expired catalog and persists the replacement", async () => {
    const stale = makeCatalog("2026-09-04T12:00:00.000Z");
    const fresh = makeCatalog("2026-09-06T12:00:00.000Z");
    const store = makeStore(stale);
    const fetchCatalog = vi.fn(async () => fresh);
    const service = new PlayerCatalogService(store, fetchCatalog);

    const result = await service.load(new Date("2026-09-05T12:00:00.000Z"));

    expect(result).toEqual({ catalog: fresh, source: "network" });
    expect(store.saveCatalog).toHaveBeenCalledWith(fresh);
  });

  it("falls back to an expired catalog when Sleeper is unavailable", async () => {
    const stale = makeCatalog("2026-09-04T12:00:00.000Z");
    const store = makeStore(stale);
    const service = new PlayerCatalogService(store, async () => {
      throw new Error("offline");
    });

    const result = await service.load(new Date("2026-09-05T12:00:00.000Z"));

    expect(result.source).toBe("stale-cache");
    expect(result.catalog).toBe(stale);
    expect(result.warning).toContain("last cached catalog");
  });

  it("shares one catalog refresh across concurrent callers", async () => {
    const fresh = makeCatalog("2026-09-06T12:00:00.000Z");
    const store = makeStore(null);
    const fetchCatalog = vi.fn(async () => fresh);
    const service = new PlayerCatalogService(store, fetchCatalog);

    const [first, second] = await Promise.all([
      service.load(new Date("2026-09-05T12:00:00.000Z")),
      service.load(new Date("2026-09-05T12:00:00.000Z")),
    ]);

    expect(first.catalog).toBe(fresh);
    expect(second.catalog).toBe(fresh);
    expect(fetchCatalog).toHaveBeenCalledTimes(1);
  });
});

function makeStore(catalog: SleeperPlayerCatalog | null): PlayerCatalogStore {
  return {
    getCatalog: vi.fn(async () => catalog),
    saveCatalog: vi.fn(async () => undefined),
  };
}

function makeCatalog(expiresAt: string): SleeperPlayerCatalog {
  return {
    catalogId: "nfl-active-offense",
    fetchedAt: "2026-09-04T12:00:00.000Z",
    expiresAt,
    players: [],
  };
}

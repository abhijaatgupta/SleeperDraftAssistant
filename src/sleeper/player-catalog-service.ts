import { playerCatalogRepository } from "../storage/player-catalog-repository";
import type { CatalogLoadResult, SleeperPlayerCatalog } from "../types/sleeper";
import { fetchSleeperPlayerCatalog } from "./player-api";

type CatalogFetcher = (
  fetchImplementation?: typeof fetch,
  fetchedAt?: Date,
) => Promise<SleeperPlayerCatalog>;

export interface PlayerCatalogStore {
  getCatalog: () => Promise<SleeperPlayerCatalog | null>;
  saveCatalog: (catalog: SleeperPlayerCatalog) => Promise<void>;
}

export class PlayerCatalogService {
  private inFlightLoad: Promise<CatalogLoadResult> | null = null;

  constructor(
    private readonly repository: PlayerCatalogStore = playerCatalogRepository,
    private readonly fetchCatalog: CatalogFetcher = fetchSleeperPlayerCatalog,
  ) {}

  async load(now = new Date()): Promise<CatalogLoadResult> {
    if (this.inFlightLoad) {
      return this.inFlightLoad;
    }

    this.inFlightLoad = this.loadCatalog(now).finally(() => {
      this.inFlightLoad = null;
    });
    return this.inFlightLoad;
  }

  private async loadCatalog(now: Date): Promise<CatalogLoadResult> {
    const cachedCatalog = await this.repository.getCatalog();

    if (cachedCatalog && new Date(cachedCatalog.expiresAt).getTime() > now.getTime()) {
      return { catalog: cachedCatalog, source: "cache" };
    }

    try {
      const catalog = await this.fetchCatalog(fetch, now);
      await this.repository.saveCatalog(catalog);
      return { catalog, source: "network" };
    } catch (error) {
      if (cachedCatalog) {
        return {
          catalog: cachedCatalog,
          source: "stale-cache",
          warning: "Sleeper could not be reached. Player matching used the last cached catalog.",
        };
      }

      throw error;
    }
  }
}

export const playerCatalogService = new PlayerCatalogService();

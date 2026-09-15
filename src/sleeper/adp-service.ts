import type { SleeperAdpFormat, SleeperAdpSnapshot } from "../types/sleeper";
import { fetchSleeperAdp } from "./adp-api";

type AdpFetcher = (
  season: string,
  format: SleeperAdpFormat,
  fetchImplementation?: typeof fetch,
  fetchedAt?: Date,
) => Promise<SleeperAdpSnapshot>;

export class SleeperAdpService {
  private readonly inFlightLoads = new Map<string, Promise<SleeperAdpSnapshot>>();

  constructor(private readonly fetchAdp: AdpFetcher = fetchSleeperAdp) {}

  load(season: string, format: SleeperAdpFormat): Promise<SleeperAdpSnapshot> {
    const key = `${season}:${format}`;
    const existing = this.inFlightLoads.get(key);
    if (existing) {
      return existing;
    }

    const load = this.fetchAdp(season, format).finally(() => {
      this.inFlightLoads.delete(key);
    });
    this.inFlightLoads.set(key, load);
    return load;
  }
}

export const sleeperAdpService = new SleeperAdpService();

import { describe, expect, it, vi } from "vitest";
import { SleeperAdpService } from "../../src/sleeper/adp-service";
import type { SleeperAdpSnapshot } from "../../src/types/sleeper";

describe("SleeperAdpService", () => {
  it("shares one same-format request across concurrent callers", async () => {
    const snapshot = makeSnapshot("half_ppr");
    const fetchAdp = vi.fn(async () => snapshot);
    const service = new SleeperAdpService(fetchAdp);

    const [first, second] = await Promise.all([
      service.load("2026", "half_ppr"),
      service.load("2026", "half_ppr"),
    ]);

    expect(first).toBe(snapshot);
    expect(second).toBe(snapshot);
    expect(fetchAdp).toHaveBeenCalledTimes(1);
  });

  it("does not combine requests for different scoring formats", async () => {
    const fetchAdp = vi.fn(async (_season, format) => makeSnapshot(format));
    const service = new SleeperAdpService(fetchAdp);

    await Promise.all([service.load("2026", "half_ppr"), service.load("2026", "ppr")]);

    expect(fetchAdp).toHaveBeenCalledTimes(2);
  });
});

function makeSnapshot(format: SleeperAdpSnapshot["format"]): SleeperAdpSnapshot {
  return { season: "2026", format, fetchedAt: "2026-09-07T12:00:00.000Z", players: [] };
}

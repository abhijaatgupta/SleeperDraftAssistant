import { describe, expect, it, vi } from "vitest";
import { fetchSleeperPlayerCatalog, SleeperPlayerApiError } from "../../src/sleeper/player-api";

describe("fetchSleeperPlayerCatalog", () => {
  it("loads the four offensive positions and normalizes the API map", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const position = new URL(String(input)).searchParams.get("position")!;
      return response({
        [`${position}-1`]: {
          player_id: `${position}-1`,
          full_name: `${position} Player`,
          position,
          fantasy_positions: [position],
          team: "buf",
          active: true,
          search_rank: 12,
        },
      });
    });

    const catalog = await fetchSleeperPlayerCatalog(
      fetchMock as typeof fetch,
      new Date("2026-09-04T12:00:00.000Z"),
    );

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining("position=QB&active=true"),
      expect.stringContaining("position=RB&active=true"),
      expect.stringContaining("position=WR&active=true"),
      expect.stringContaining("position=TE&active=true"),
    ]);
    expect(catalog).toMatchObject({
      catalogId: "nfl-active-offense",
      fetchedAt: "2026-09-04T12:00:00.000Z",
      expiresAt: "2026-09-05T12:00:00.000Z",
    });
    expect(catalog.players).toHaveLength(4);
    expect(catalog.players[0]).toMatchObject({
      playerId: "QB-1",
      name: "QB Player",
      normalizedName: "qb player",
      position: "QB",
      fantasyPositions: ["QB"],
      team: "BUF",
      active: true,
      searchRank: 12,
    });
  });

  it("rejects an unsuccessful position request", async () => {
    const fetchMock = vi.fn(async () => response({}, false, 503));

    await expect(fetchSleeperPlayerCatalog(fetchMock as typeof fetch)).rejects.toBeInstanceOf(
      SleeperPlayerApiError,
    );
  });
});

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

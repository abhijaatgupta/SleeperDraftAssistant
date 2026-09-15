import { describe, expect, it, vi } from "vitest";
import { fetchSleeperAdp, SleeperAdpApiError } from "../../src/sleeper/adp-api";

describe("fetchSleeperAdp", () => {
  it.each([
    ["standard", "adp_std"],
    ["half_ppr", "adp_half_ppr"],
    ["ppr", "adp_ppr"],
    ["2qb", "adp_2qb"],
  ] as const)("maps %s to %s and loads all positions in one request", async (format, stat) => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      void input;
      return response([
        {
          player_id: "123",
          player: { position: "WR", fantasy_positions: ["WR"] },
          stats: { [stat]: 12.4 },
        },
      ]);
    });

    const result = await fetchSleeperAdp(
      "2026",
      format,
      fetchMock as typeof fetch,
      new Date("2026-09-07T12:00:00.000Z"),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/projections/nfl/2026");
    expect(url.searchParams.get("season_type")).toBe("regular");
    expect(url.searchParams.getAll("position[]")).toEqual(["QB", "RB", "WR", "TE"]);
    expect(url.searchParams.get("order_by")).toBe(stat);
    expect(result).toEqual({
      season: "2026",
      format,
      fetchedAt: "2026-09-07T12:00:00.000Z",
      players: [
        {
          playerId: "123",
          position: "WR",
          fantasyPositions: ["WR"],
          overallAdp: 12.4,
        },
      ],
    });
  });

  it("rejects unsuccessful and malformed responses", async () => {
    await expect(
      fetchSleeperAdp(
        "2026",
        "half_ppr",
        vi.fn(async () => response({}, false, 503)) as typeof fetch,
      ),
    ).rejects.toBeInstanceOf(SleeperAdpApiError);

    await expect(
      fetchSleeperAdp("2026", "half_ppr", vi.fn(async () => response({})) as typeof fetch),
    ).rejects.toBeInstanceOf(SleeperAdpApiError);
  });

  it("treats a two-way DB/WR player as a WR", async () => {
    const fetchMock = vi.fn(async () =>
      response([
        {
          player_id: "12530",
          player: { position: "DB", fantasy_positions: ["DB", "WR"] },
          stats: { adp_half_ppr: 191.2 },
        },
      ]),
    );

    const result = await fetchSleeperAdp("2026", "half_ppr", fetchMock as typeof fetch);

    expect(result.players).toEqual([
      {
        playerId: "12530",
        position: "WR",
        fantasyPositions: ["WR"],
        overallAdp: 191.2,
      },
    ]);
  });

  it("does not import ordinary defensive backs", async () => {
    const fetchMock = vi.fn(async () =>
      response([
        {
          player_id: "db-only",
          player: { position: "DB", fantasy_positions: ["DB"] },
          stats: { adp_half_ppr: 200 },
        },
      ]),
    );

    await expect(fetchSleeperAdp("2026", "half_ppr", fetchMock as typeof fetch)).rejects.toThrow(
      "returned no half-ppr ADP values",
    );
  });
});

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

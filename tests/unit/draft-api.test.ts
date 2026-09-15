import { describe, expect, it, vi } from "vitest";
import {
  fetchSleeperDraft,
  fetchSleeperDraftPicks,
  fetchSleeperDraftTradedPicks,
  resolveSleeperAdpFormat,
  SleeperDraftApiError,
} from "../../src/sleeper/draft-api";

describe("Sleeper draft API", () => {
  it("normalizes draft metadata", async () => {
    const fetchMock = vi.fn(async () =>
      response({
        draft_id: "12345678",
        type: "snake",
        status: "drafting",
        season: "2026",
        settings: {
          teams: 12,
          rounds: 16,
          pick_timer: 30,
          slots_qb: 1,
          slots_rb: 2,
          slots_wr: 3,
          slots_te: 1,
          slots_flex: 2,
          slots_k: 1,
          slots_def: 1,
          slots_bn: 5,
        },
        metadata: { name: "Test Draft", scoring_type: "half_ppr" },
        draft_order: { user1: 2 },
        slot_to_roster_id: { 2: 8 },
        creators: ["user1"],
      }),
    );

    await expect(fetchSleeperDraft("12345678", fetchMock as typeof fetch)).resolves.toEqual({
      draftId: "12345678",
      name: "Test Draft",
      status: "drafting",
      type: "snake",
      season: "2026",
      scoringFormat: "half_ppr",
      teams: 12,
      rounds: 16,
      pickTimerSeconds: 30,
      rosterSettings: {
        qb: 1,
        rb: 2,
        wr: 3,
        te: 1,
        flex: 2,
        receiverFlex: 0,
        superFlex: 0,
        kicker: 1,
        defense: 1,
        bench: 5,
      },
      draftOrder: { user1: 2 },
      slotToRosterId: { 2: 8 },
      creatorUserIds: ["user1"],
    });
  });

  it("maps draft scoring metadata and quarterback-heavy rosters to ADP formats", () => {
    expect(resolveSleeperAdpFormat({ scoring_type: "ppr" }, { slots_qb: 1 })).toBe("ppr");
    expect(resolveSleeperAdpFormat({ scoring_type: "std" }, { slots_qb: 1 })).toBe("standard");
    expect(resolveSleeperAdpFormat({ scoring_type: "half_ppr" }, { slots_qb: 2 })).toBe("2qb");
    expect(
      resolveSleeperAdpFormat({ scoring_type: "ppr" }, { slots_qb: 1, slots_super_flex: 1 }),
    ).toBe("2qb");
    expect(resolveSleeperAdpFormat(null, null)).toBe("half_ppr");
  });

  it("normalizes traded pick ownership", async () => {
    const fetchMock = vi.fn(async () =>
      response([{ round: 4, roster_id: 2, previous_owner_id: 3, owner_id: 1 }]),
    );

    await expect(
      fetchSleeperDraftTradedPicks("12345678", fetchMock as typeof fetch),
    ).resolves.toEqual([{ round: 4, originalRosterId: 2, previousOwnerId: 3, ownerId: 1 }]);
  });

  it("normalizes and sorts the complete picks response", async () => {
    const fetchMock = vi.fn(async () =>
      response([
        {
          player_id: "20",
          pick_no: 3,
          round: 1,
          draft_slot: 3,
          roster_id: "8",
          metadata: { first_name: "Future", last_name: "Keeper", position: "TE", team: "TST" },
          is_keeper: true,
        },
        { player_id: "10", pick_no: 1, round: 1, draft_slot: 1, is_keeper: null },
      ]),
    );

    const picks = await fetchSleeperDraftPicks("12345678", fetchMock as typeof fetch);

    expect(picks.map((pick) => pick.pickNumber)).toEqual([1, 3]);
    expect(picks[1]).toMatchObject({
      playerId: "20",
      rosterId: "8",
      playerName: "Future Keeper",
      position: "TE",
      team: "TST",
      isKeeper: true,
    });
    expect((fetchMock.mock.calls as unknown[][])[0]?.[0]).toMatch(
      /^https:\/\/api\.sleeper\.app\/v1\/draft\/12345678\/picks\?_=\d+$/,
    );
  });

  it("surfaces HTTP failures", async () => {
    const fetchMock = vi.fn(async () => response({}, false, 503));
    await expect(fetchSleeperDraft("12345678", fetchMock as typeof fetch)).rejects.toBeInstanceOf(
      SleeperDraftApiError,
    );
  });
});

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

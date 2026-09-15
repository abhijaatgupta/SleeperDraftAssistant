import type {
  SleeperDraft,
  SleeperDraftPick,
  SleeperDraftStatus,
  SleeperTradedPick,
} from "../types/draft";
import type { SleeperAdpFormat } from "../types/sleeper";

const DRAFT_ENDPOINT = "https://api.sleeper.app/v1/draft";

export class SleeperDraftApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SleeperDraftApiError";
  }
}

export async function fetchSleeperDraft(
  draftId: string,
  fetchImplementation: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<SleeperDraft> {
  const raw = await fetchJson(
    `${DRAFT_ENDPOINT}/${encodeURIComponent(draftId)}`,
    fetchImplementation,
    signal,
  );
  const record = asRecord(raw);
  const settings = asRecord(record?.settings);
  const metadata = asRecord(record?.metadata);
  const teams = readPositiveInteger(settings?.teams);
  const rounds = readPositiveInteger(settings?.rounds);

  if (!record || !teams || !rounds) {
    throw new SleeperDraftApiError("Sleeper returned invalid draft metadata.");
  }

  return {
    draftId: readText(record.draft_id) || draftId,
    name: readText(metadata?.name) || "Sleeper Draft",
    status: readDraftStatus(record.status),
    type: readText(record.type) || "unknown",
    season: readText(record.season) || undefined,
    scoringFormat: resolveSleeperAdpFormat(metadata, settings),
    teams,
    rounds,
    pickTimerSeconds: readPositiveInteger(settings?.pick_timer) ?? undefined,
    rosterSettings: {
      qb: readNonNegativeInteger(settings?.slots_qb),
      rb: readNonNegativeInteger(settings?.slots_rb),
      wr: readNonNegativeInteger(settings?.slots_wr),
      te: readNonNegativeInteger(settings?.slots_te),
      flex: readNonNegativeInteger(settings?.slots_flex),
      receiverFlex: readNonNegativeInteger(settings?.slots_rec_flex),
      superFlex: readNonNegativeInteger(settings?.slots_super_flex),
      kicker: readNonNegativeInteger(settings?.slots_k),
      defense: readNonNegativeInteger(settings?.slots_def),
      bench: readNonNegativeInteger(settings?.slots_bn),
    },
    draftOrder: readStringNumberMap(record.draft_order),
    slotToRosterId: readNumberMap(record.slot_to_roster_id),
    creatorUserIds: Array.isArray(record.creators)
      ? record.creators.map(readText).filter(Boolean)
      : [],
  };
}

export function resolveSleeperAdpFormat(
  metadata: Record<string, unknown> | null,
  settings: Record<string, unknown> | null,
): SleeperAdpFormat {
  const scoringType = readText(metadata?.scoring_type).toLowerCase();
  const quarterbackSlots = readNonNegativeInteger(settings?.slots_qb);
  const superFlexSlots = readNonNegativeInteger(settings?.slots_super_flex);

  if (
    quarterbackSlots >= 2 ||
    superFlexSlots > 0 ||
    ["2qb", "2_qb", "superflex", "super_flex"].includes(scoringType)
  ) {
    return "2qb";
  }

  if (["ppr", "full_ppr"].includes(scoringType)) {
    return "ppr";
  }

  if (["standard", "std", "non_ppr", "non-ppr"].includes(scoringType)) {
    return "standard";
  }

  return "half_ppr";
}

export async function fetchSleeperDraftPicks(
  draftId: string,
  fetchImplementation: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<SleeperDraftPick[]> {
  const raw = await fetchJson(
    `${DRAFT_ENDPOINT}/${encodeURIComponent(draftId)}/picks`,
    fetchImplementation,
    signal,
  );
  if (!Array.isArray(raw)) {
    throw new SleeperDraftApiError("Sleeper returned an invalid draft-picks response.");
  }

  return raw
    .map((value): SleeperDraftPick | null => {
      const record = asRecord(value);
      const playerId = readText(record?.player_id);
      const pickNumber = readPositiveInteger(record?.pick_no);
      if (!record || !playerId || !pickNumber) {
        return null;
      }

      const metadata = asRecord(record.metadata);
      const playerName =
        readText(metadata?.full_name) ||
        readText(metadata?.name) ||
        [readText(metadata?.first_name), readText(metadata?.last_name)].filter(Boolean).join(" ");

      return {
        playerId,
        pickNumber,
        round: readPositiveInteger(record.round) ?? 0,
        draftSlot: readPositiveInteger(record.draft_slot) ?? 0,
        rosterId: readText(record.roster_id) || undefined,
        pickedBy: readText(record.picked_by) || undefined,
        playerName: playerName || undefined,
        position: readText(metadata?.position).toUpperCase() || undefined,
        team: readText(metadata?.team).toUpperCase() || undefined,
        isKeeper: record.is_keeper === true,
      };
    })
    .filter((pick): pick is SleeperDraftPick => pick !== null)
    .sort((left, right) => left.pickNumber - right.pickNumber);
}

export async function fetchSleeperDraftTradedPicks(
  draftId: string,
  fetchImplementation: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<SleeperTradedPick[]> {
  const raw = await fetchJson(
    `${DRAFT_ENDPOINT}/${encodeURIComponent(draftId)}/traded_picks`,
    fetchImplementation,
    signal,
  );
  if (!Array.isArray(raw)) {
    throw new SleeperDraftApiError("Sleeper returned an invalid traded-picks response.");
  }

  return raw
    .map((value): SleeperTradedPick | null => {
      const record = asRecord(value);
      const round = readPositiveInteger(record?.round);
      const originalRosterId = readPositiveInteger(record?.roster_id);
      const previousOwnerId = readPositiveInteger(record?.previous_owner_id);
      const ownerId = readPositiveInteger(record?.owner_id);
      return record && round && originalRosterId && previousOwnerId && ownerId
        ? { round, originalRosterId, previousOwnerId, ownerId }
        : null;
    })
    .filter((pick): pick is SleeperTradedPick => pick !== null);
}

async function fetchJson(
  url: string,
  fetchImplementation: typeof fetch,
  signal?: AbortSignal,
): Promise<unknown> {
  const init: RequestInit = { method: "GET", cache: "no-store" };
  if (signal) {
    init.signal = signal;
  }
  const separator = url.includes("?") ? "&" : "?";
  const response = await fetchImplementation(`${url}${separator}_=${Date.now()}`, init);
  if (!response.ok) {
    throw new SleeperDraftApiError(`Sleeper draft request failed with HTTP ${response.status}.`);
  }
  return response.json();
}

function readDraftStatus(value: unknown): SleeperDraftStatus {
  const status = readText(value);
  return ["pre_draft", "drafting", "paused", "complete"].includes(status)
    ? (status as SleeperDraftStatus)
    : "unknown";
}

function readPositiveInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function readNonNegativeInteger(value: unknown): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function readText(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readStringNumberMap(value: unknown): Record<string, number> {
  const record = asRecord(value);
  if (!record) return {};

  return Object.fromEntries(
    Object.entries(record)
      .map(([key, mapValue]) => [key, readPositiveInteger(mapValue)] as const)
      .filter((entry): entry is readonly [string, number] => entry[1] !== null),
  );
}

function readNumberMap(value: unknown): Record<number, number> {
  const record = asRecord(value);
  if (!record) return {};

  return Object.fromEntries(
    Object.entries(record)
      .map(([key, mapValue]) => [readPositiveInteger(key), readPositiveInteger(mapValue)] as const)
      .filter(
        (entry): entry is readonly [number, number] => entry[0] !== null && entry[1] !== null,
      ),
  );
}

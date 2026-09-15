import { BOARD_POSITIONS, type BoardPosition } from "../types/board";
import type { SleeperAdpFormat, SleeperAdpPlayer, SleeperAdpSnapshot } from "../types/sleeper";

const PROJECTIONS_ENDPOINT = "https://api.sleeper.app/projections/nfl";

const ADP_STAT_BY_FORMAT: Record<SleeperAdpFormat, string> = {
  standard: "adp_std",
  half_ppr: "adp_half_ppr",
  ppr: "adp_ppr",
  "2qb": "adp_2qb",
};

interface SleeperProjection {
  player_id?: unknown;
  player?: {
    position?: unknown;
    fantasy_positions?: unknown;
  };
  stats?: Record<string, unknown>;
}

export class SleeperAdpApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SleeperAdpApiError";
  }
}

export async function fetchSleeperAdp(
  season: string,
  format: SleeperAdpFormat,
  fetchImplementation: typeof fetch = fetch,
  fetchedAt = new Date(),
): Promise<SleeperAdpSnapshot> {
  const stat = ADP_STAT_BY_FORMAT[format];
  const url = new URL(`${PROJECTIONS_ENDPOINT}/${encodeURIComponent(season)}`);
  url.searchParams.set("season_type", "regular");
  for (const position of BOARD_POSITIONS) {
    url.searchParams.append("position[]", position);
  }
  url.searchParams.set("order_by", stat);

  const response = await fetchImplementation(url.toString(), { method: "GET" });
  if (!response.ok) {
    throw new SleeperAdpApiError(`Sleeper ADP request failed with HTTP ${response.status}.`);
  }

  const raw = await response.json();
  if (!Array.isArray(raw)) {
    throw new SleeperAdpApiError("Sleeper returned an invalid ADP response.");
  }

  const players = raw
    .map((value) => parseProjection(value, stat))
    .filter((player): player is SleeperAdpPlayer => player !== null);

  if (players.length === 0) {
    throw new SleeperAdpApiError(`Sleeper returned no ${formatLabel(format)} ADP values.`);
  }

  return {
    season,
    format,
    fetchedAt: fetchedAt.toISOString(),
    players,
  };
}

function parseProjection(value: unknown, stat: string): SleeperAdpPlayer | null {
  const raw = value as SleeperProjection;
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const playerId = readText(raw.player_id);
  const listedPosition = readText(raw.player?.position).toUpperCase();
  const primaryPosition = readPosition(listedPosition);
  const fantasyPositions = readFantasyPositions(raw.player?.fantasy_positions, primaryPosition);
  const position =
    primaryPosition ?? (listedPosition === "DB" && fantasyPositions.includes("WR") ? "WR" : null);
  const overallAdp = Number(raw.stats?.[stat]);
  if (!playerId || !position || !Number.isFinite(overallAdp) || overallAdp <= 0) {
    return null;
  }

  return {
    playerId,
    position,
    fantasyPositions,
    overallAdp,
  };
}

function readFantasyPositions(value: unknown, fallback: BoardPosition | null): BoardPosition[] {
  if (!Array.isArray(value)) {
    return fallback ? [fallback] : [];
  }

  const positions = value.map(readPosition).filter((position) => position !== null);
  return positions.length > 0 ? [...new Set(positions)] : fallback ? [fallback] : [];
}

function readPosition(value: unknown): BoardPosition | null {
  const position = readText(value).toUpperCase();
  return BOARD_POSITIONS.find((candidate) => candidate === position) ?? null;
}

function readText(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function formatLabel(format: SleeperAdpFormat): string {
  return format === "2qb" ? "2QB" : format.replace("_", "-");
}

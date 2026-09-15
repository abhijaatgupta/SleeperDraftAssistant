import { normalizePlayerName } from "../import/normalize-player-name";
import { BOARD_POSITIONS, type BoardPosition } from "../types/board";
import {
  SLEEPER_CATALOG_ID,
  type SleeperPlayer,
  type SleeperPlayerCatalog,
} from "../types/sleeper";

const PLAYER_ENDPOINT = "https://api.sleeper.app/v1/players/nfl";
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;

interface SleeperApiPlayer {
  player_id?: unknown;
  full_name?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  position?: unknown;
  fantasy_positions?: unknown;
  team?: unknown;
  active?: unknown;
  search_rank?: unknown;
}

export class SleeperPlayerApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SleeperPlayerApiError";
  }
}

export async function fetchSleeperPlayerCatalog(
  fetchImplementation: typeof fetch = fetch,
  fetchedAt = new Date(),
): Promise<SleeperPlayerCatalog> {
  const responses = await Promise.all(
    BOARD_POSITIONS.map(async (position) => {
      const url = `${PLAYER_ENDPOINT}?position=${position}&active=true`;
      const response = await fetchImplementation(url, { method: "GET" });

      if (!response.ok) {
        throw new SleeperPlayerApiError(
          `Sleeper player catalog request for ${position} failed with HTTP ${response.status}.`,
        );
      }

      return parsePlayerMap(await response.json(), position);
    }),
  );

  const playersById = new Map<string, SleeperPlayer>();

  for (const player of responses.flat()) {
    const existing = playersById.get(player.playerId);
    if (!existing) {
      playersById.set(player.playerId, player);
      continue;
    }

    playersById.set(player.playerId, {
      ...existing,
      fantasyPositions: [...new Set([...existing.fantasyPositions, ...player.fantasyPositions])],
    });
  }

  if (playersById.size === 0) {
    throw new SleeperPlayerApiError("Sleeper returned an empty offensive player catalog.");
  }

  return {
    catalogId: SLEEPER_CATALOG_ID,
    fetchedAt: fetchedAt.toISOString(),
    expiresAt: new Date(fetchedAt.getTime() + CATALOG_TTL_MS).toISOString(),
    players: [...playersById.values()],
  };
}

function parsePlayerMap(value: unknown, requestedPosition: BoardPosition): SleeperPlayer[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SleeperPlayerApiError(
      `Sleeper returned an invalid ${requestedPosition} player catalog.`,
    );
  }

  const players: SleeperPlayer[] = [];

  for (const [mapPlayerId, rawValue] of Object.entries(value)) {
    const raw = rawValue as SleeperApiPlayer;
    if (!raw || typeof raw !== "object") {
      continue;
    }

    const playerId = readText(raw.player_id) || mapPlayerId;
    const name =
      readText(raw.full_name) ||
      [readText(raw.first_name), readText(raw.last_name)].join(" ").trim();
    const position = readPosition(raw.position) ?? requestedPosition;
    const fantasyPositions = readFantasyPositions(raw.fantasy_positions, position);

    if (!playerId || !name || !fantasyPositions.includes(requestedPosition)) {
      continue;
    }

    const team = readText(raw.team).toUpperCase() || undefined;
    const searchRank = Number(raw.search_rank);

    players.push({
      playerId,
      name,
      normalizedName: normalizePlayerName(name),
      position,
      fantasyPositions,
      team,
      active: raw.active === true,
      searchRank: Number.isFinite(searchRank) ? searchRank : undefined,
    });
  }

  return players;
}

function readFantasyPositions(value: unknown, fallback: BoardPosition): BoardPosition[] {
  if (!Array.isArray(value)) {
    return [fallback];
  }

  const positions = value.map(readPosition).filter((position) => position !== null);
  return positions.length > 0 ? [...new Set(positions)] : [fallback];
}

function readPosition(value: unknown): BoardPosition | null {
  const position = readText(value).toUpperCase();
  return BOARD_POSITIONS.find((candidate) => candidate === position) ?? null;
}

function readText(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

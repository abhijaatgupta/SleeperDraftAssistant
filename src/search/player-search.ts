import { normalizePlayerName } from "../import/normalize-player-name";
import type { ImportedPlayer } from "../types/board";

export type PlayerAvailability = "available" | "drafted" | "keeper" | "unmatched";

export interface PlayerSearchResult {
  player: ImportedPlayer;
  availability: PlayerAvailability;
}

export function searchBoardPlayers(
  players: ImportedPlayer[],
  query: string,
  draftedPlayerIds: Iterable<string> = [],
  futureAssignedPlayerIds: Iterable<string> = [],
  limit = 8,
): PlayerSearchResult[] {
  const normalizedQuery = normalizePlayerName(query);
  if (!normalizedQuery) return [];

  const drafted = new Set(draftedPlayerIds);
  const futureAssigned = new Set(futureAssignedPlayerIds);
  const queryTokens = normalizedQuery.split(" ");

  return players
    .map((player) => ({
      player,
      availability: getPlayerAvailability(player, drafted, futureAssigned),
      matchRank: getMatchRank(player.normalizedName, normalizedQuery, queryTokens),
    }))
    .filter((result) => result.matchRank !== null)
    .sort(
      (left, right) =>
        availabilityRank(left.availability) - availabilityRank(right.availability) ||
        (left.matchRank as number) - (right.matchRank as number) ||
        left.player.modelOverallAdp - right.player.modelOverallAdp ||
        left.player.normalizedName.localeCompare(right.player.normalizedName),
    )
    .slice(0, Math.max(0, limit))
    .map(({ player, availability }) => ({ player, availability }));
}

export function getPlayerAvailability(
  player: ImportedPlayer,
  draftedPlayerIds: ReadonlySet<string>,
  futureAssignedPlayerIds: ReadonlySet<string>,
): PlayerAvailability {
  const playerId = player.sleeperPlayerId;
  if (!playerId) return "unmatched";
  if (futureAssignedPlayerIds.has(playerId)) return "keeper";
  if (draftedPlayerIds.has(playerId)) return "drafted";
  return "available";
}

function getMatchRank(
  normalizedName: string,
  normalizedQuery: string,
  queryTokens: string[],
): number | null {
  if (normalizedName === normalizedQuery) return 0;

  const nameTokens = normalizedName.split(" ");
  if (queryTokens.every((queryToken) => nameTokens.some((token) => token === queryToken))) return 1;
  if (queryTokens.every((queryToken) => nameTokens.some((token) => token.startsWith(queryToken)))) {
    return 2;
  }
  if (queryTokens.every((queryToken) => nameTokens.some((token) => token.includes(queryToken)))) {
    return 3;
  }
  return null;
}

function availabilityRank(availability: PlayerAvailability): number {
  switch (availability) {
    case "available":
      return 0;
    case "keeper":
      return 1;
    case "drafted":
      return 2;
    case "unmatched":
      return 3;
  }
}

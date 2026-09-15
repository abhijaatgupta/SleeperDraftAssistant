import { normalizePlayerName } from "../import/normalize-player-name";
import type { ImportedPlayer, StoredBoard } from "../types/board";
import type {
  BoardMatchSummary,
  PlayerMatchCandidate,
  PlayerMatchIssue,
  PlayerMatchMethod,
  SleeperPlayer,
  SleeperPlayerCatalog,
} from "../types/sleeper";

export const PLAYER_MATCHER_VERSION = 2;
const SUFFIX_PATTERN = /\s+(jr|sr|ii|iii|iv|v)$/;

export interface BoardMatchingResult {
  board: StoredBoard;
  summary: BoardMatchSummary;
}

export function matchBoardPlayers(
  board: StoredBoard,
  catalog: SleeperPlayerCatalog,
  matchedAt = new Date(),
): BoardMatchingResult {
  const playersById = new Map(catalog.players.map((player) => [player.playerId, player]));
  const issues: PlayerMatchIssue[] = [];

  const players = board.players.map((boardPlayer) => {
    const result = matchPlayer(boardPlayer, catalog.players, playersById);
    if (result.issue) {
      issues.push(result.issue);
    }

    const position =
      result.player && boardPlayer.sourcePositionProvided === false
        ? result.player.position
        : boardPlayer.position;

    return {
      ...boardPlayer,
      boardPlayerId: `${position}:${boardPlayer.normalizedName}`,
      position,
      team: result.player?.team ?? boardPlayer.team,
      sleeperPlayerId: result.player?.playerId,
      sleeperMatchMethod: result.method,
    };
  });

  const summary: BoardMatchSummary = {
    matcherVersion: PLAYER_MATCHER_VERSION,
    catalogFetchedAt: catalog.fetchedAt,
    matchedAt: matchedAt.toISOString(),
    matchedCount: players.filter((player) => player.sleeperPlayerId !== undefined).length,
    unmatchedCount: issues.filter((issue) => issue.kind === "unmatched").length,
    ambiguousCount: issues.filter((issue) => issue.kind === "ambiguous").length,
    invalidProvidedIdCount: issues.filter((issue) => issue.kind === "invalid-provided-id").length,
    issues,
  };

  return {
    board: { ...board, players, matching: summary },
    summary,
  };
}

function matchPlayer(
  boardPlayer: ImportedPlayer,
  catalogPlayers: SleeperPlayer[],
  playersById: Map<string, SleeperPlayer>,
): { player?: SleeperPlayer; method?: PlayerMatchMethod; issue?: PlayerMatchIssue } {
  const providedId = boardPlayer.providedSleeperPlayerId;
  if (providedId) {
    const providedPlayer = playersById.get(providedId);
    if (providedPlayer && supportsPosition(providedPlayer, boardPlayer)) {
      return { player: providedPlayer, method: "provided-id" };
    }

    return {
      issue: createIssue("invalid-provided-id", boardPlayer, [], providedId),
    };
  }

  const positionPlayers = catalogPlayers.filter((player) => supportsPosition(player, boardPlayer));
  const exactCandidates = positionPlayers.filter(
    (player) => player.normalizedName === boardPlayer.normalizedName,
  );
  const exact = resolveCandidates(boardPlayer, exactCandidates);
  if (exact.player) {
    return { player: exact.player, method: "exact-name" };
  }
  if (exact.ambiguous) {
    return { issue: createIssue("ambiguous", boardPlayer, exactCandidates) };
  }

  const relaxedName = removeSuffix(boardPlayer.normalizedName);
  const relaxedCandidates = positionPlayers.filter(
    (player) => removeSuffix(player.normalizedName) === relaxedName,
  );
  const relaxed = resolveCandidates(boardPlayer, relaxedCandidates);
  if (relaxed.player) {
    return { player: relaxed.player, method: "name-without-suffix" };
  }
  if (relaxed.ambiguous) {
    return { issue: createIssue("ambiguous", boardPlayer, relaxedCandidates) };
  }

  return { issue: createIssue("unmatched", boardPlayer, []) };
}

function resolveCandidates(
  boardPlayer: ImportedPlayer,
  candidates: SleeperPlayer[],
): { player?: SleeperPlayer; ambiguous: boolean } {
  if (candidates.length === 1) {
    return { player: candidates[0], ambiguous: false };
  }

  if (candidates.length > 1) {
    const teamMatches = candidates.filter((candidate) => candidate.team === boardPlayer.team);
    if (teamMatches.length === 1) {
      return { player: teamMatches[0], ambiguous: false };
    }
    return { ambiguous: true };
  }

  return { ambiguous: false };
}

function supportsPosition(player: SleeperPlayer, boardPlayer: ImportedPlayer): boolean {
  return (
    boardPlayer.sourcePositionProvided === false ||
    player.fantasyPositions.includes(boardPlayer.position)
  );
}

function removeSuffix(value: string): string {
  return normalizePlayerName(value).replace(SUFFIX_PATTERN, "");
}

function createIssue(
  kind: PlayerMatchIssue["kind"],
  boardPlayer: ImportedPlayer,
  candidates: SleeperPlayer[],
  providedSleeperPlayerId?: string,
): PlayerMatchIssue {
  return {
    kind,
    boardPlayerId: boardPlayer.boardPlayerId,
    name: boardPlayer.name,
    position: boardPlayer.position,
    team: boardPlayer.team,
    providedSleeperPlayerId,
    candidates: candidates.map(toCandidate),
  };
}

function toCandidate(player: SleeperPlayer): PlayerMatchCandidate {
  return {
    playerId: player.playerId,
    name: player.name,
    position: player.position,
    team: player.team,
  };
}

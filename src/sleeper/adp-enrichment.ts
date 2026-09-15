import { BOARD_POSITIONS, type BoardPosition, type StoredBoard } from "../types/board";
import type { SleeperAdpPlayer, SleeperAdpSnapshot } from "../types/sleeper";

export interface AdpEnrichmentResult {
  board: StoredBoard;
  updatedCount: number;
  missingPlayerNames: string[];
}

export class ModelRankingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelRankingError";
  }
}

export function enrichBoardWithSleeperAdp(
  board: StoredBoard,
  snapshot: SleeperAdpSnapshot,
): AdpEnrichmentResult {
  const entriesById = new Map(snapshot.players.map((player) => [player.playerId, player]));
  const positionOrders = buildPositionOrders(snapshot.players);
  const positionRanks = buildPositionRanks(positionOrders);
  const overallRanks = buildOverallRanks(snapshot.players);
  const missingPlayerNames: string[] = [];
  let updatedCount = 0;

  validateProvidedPositionRanks(board);

  let players = board.players.map((player) => {
    if (!player.sleeperPlayerId) {
      return player;
    }

    const entry = entriesById.get(player.sleeperPlayerId);
    const positionRank = positionRanks.get(player.position)?.get(player.sleeperPlayerId);
    const overallRank = overallRanks.get(player.sleeperPlayerId);
    if (!entry || positionRank === undefined || overallRank === undefined) {
      missingPlayerNames.push(player.name);
      return player;
    }

    let modelOverallAdp = player.modelOverallAdp;
    if (player.modelOverallAdpProvided === false && player.modelPositionRankProvided === true) {
      const curveValue = positionOrders.get(player.position)?.[player.modelPositionRank - 1];
      if (!curveValue) {
        throw new ModelRankingError(
          `${player.name}'s ${player.position}${player.modelPositionRank} model rank is outside Sleeper's available ${player.position} ADP curve.`,
        );
      }
      modelOverallAdp = curveValue.overallAdp;
    }

    updatedCount += 1;
    return {
      ...player,
      sleeperOverallAdp: entry.overallAdp,
      sleeperOverallRank: overallRank,
      sleeperPositionAdp: positionRank,
      modelOverallAdp,
      overallEdge: entry.overallAdp - modelOverallAdp,
      positionEdge: positionRank - player.modelPositionRank,
    };
  });

  players = deriveMissingModelPositionRanks(players);
  validateFinalPositionRanks(players);
  players = players.map((player) => ({
    ...player,
    positionEdge: player.sleeperPositionAdp - player.modelPositionRank,
    overallEdge: player.sleeperOverallAdp - player.modelOverallAdp,
  }));

  return {
    board: {
      ...board,
      metadata: {
        ...board.metadata,
        sleeperAdpFormat: snapshot.format,
        sleeperAdpSeason: snapshot.season,
        sleeperAdpFetchedAt: snapshot.fetchedAt,
      },
      players,
    },
    updatedCount,
    missingPlayerNames,
  };
}

function buildOverallRanks(players: SleeperAdpPlayer[]): Map<string, number> {
  const ordered = [...players].sort(
    (left, right) =>
      left.overallAdp - right.overallAdp || left.playerId.localeCompare(right.playerId),
  );
  return new Map(ordered.map((player, index) => [player.playerId, index + 1]));
}

function buildPositionOrders(players: SleeperAdpPlayer[]): Map<BoardPosition, SleeperAdpPlayer[]> {
  return new Map(
    BOARD_POSITIONS.map((position) => [
      position,
      players
        .filter((player) => player.fantasyPositions.includes(position))
        .sort(
          (left, right) =>
            left.overallAdp - right.overallAdp || left.playerId.localeCompare(right.playerId),
        ),
    ]),
  );
}

function buildPositionRanks(
  positionOrders: Map<BoardPosition, SleeperAdpPlayer[]>,
): Map<BoardPosition, Map<string, number>> {
  const ranks = new Map<BoardPosition, Map<string, number>>();

  for (const position of BOARD_POSITIONS) {
    const ordered = positionOrders.get(position) ?? [];
    const positionRanks = new Map<string, number>();
    let previousAdp: number | null = null;
    let rank = 0;

    ordered.forEach((player, index) => {
      if (previousAdp !== player.overallAdp) {
        rank = index + 1;
        previousAdp = player.overallAdp;
      }
      positionRanks.set(player.playerId, rank);
    });
    ranks.set(position, positionRanks);
  }

  return ranks;
}

function deriveMissingModelPositionRanks(players: StoredBoard["players"]): StoredBoard["players"] {
  const derivedRanks = new Map<string, number>();

  for (const position of BOARD_POSITIONS) {
    const ordered = players
      .filter((player) => player.position === position && Boolean(player.sleeperPlayerId))
      .sort(
        (left, right) =>
          left.modelOverallAdp - right.modelOverallAdp ||
          left.normalizedName.localeCompare(right.normalizedName),
      );
    ordered.forEach((player, index) => {
      derivedRanks.set(player.boardPlayerId, index + 1);
    });
  }

  return players.map((player) =>
    player.modelPositionRankProvided === false && derivedRanks.has(player.boardPlayerId)
      ? { ...player, modelPositionRank: derivedRanks.get(player.boardPlayerId) as number }
      : player,
  );
}

function validateFinalPositionRanks(players: StoredBoard["players"]): void {
  for (const position of BOARD_POSITIONS) {
    const rowsByRank = new Map<number, string>();
    for (const player of players) {
      if (
        player.position !== position ||
        !player.sleeperPlayerId ||
        player.modelPositionRankProvided === undefined
      ) {
        continue;
      }

      const priorName = rowsByRank.get(player.modelPositionRank);
      if (priorName) {
        throw new ModelRankingError(
          `${priorName} and ${player.name} both resolve to ${position}${player.modelPositionRank}. Model positional ranks must be unique within a position.`,
        );
      }
      rowsByRank.set(player.modelPositionRank, player.name);
    }
  }
}

function validateProvidedPositionRanks(board: StoredBoard): void {
  for (const position of BOARD_POSITIONS) {
    const rowsByRank = new Map<number, string>();
    for (const player of board.players) {
      if (
        player.position !== position ||
        !player.sleeperPlayerId ||
        player.modelPositionRankProvided !== true
      ) {
        continue;
      }

      const priorName = rowsByRank.get(player.modelPositionRank);
      if (priorName) {
        throw new ModelRankingError(
          `${priorName} and ${player.name} both use ${position}${player.modelPositionRank}. Model Pos Rank values must be unique within a position.`,
        );
      }
      rowsByRank.set(player.modelPositionRank, player.name);
    }
  }
}

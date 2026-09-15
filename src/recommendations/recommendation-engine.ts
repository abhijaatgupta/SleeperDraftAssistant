import { BOARD_POSITIONS, type BoardPosition, type ImportedPlayer } from "../types/board";

export type PickTimingKind = "early" | "value" | "discount";

export interface PickTiming {
  kind: PickTimingKind;
  picks: number;
  basis?: "position" | "overall";
}

export interface PlayerRecommendation {
  player: ImportedPlayer;
  sleeperExpectedPick: number | null;
  countedAtPosition: number;
  positionTiming: PickTiming;
  modelTiming: PickTiming | null;
  sleeperTiming: PickTiming | null;
}

export interface RemainingPoolTiming {
  sleeperExpectedPick: number | null;
  countedAtPosition: number;
  countedOverall: number;
  positionTiming: PickTiming;
  modelTiming: PickTiming | null;
  sleeperTiming: PickTiming | null;
}

export interface PositionRecommendations {
  position: BoardPosition;
  availableCount: number;
  players: PlayerRecommendation[];
}

export function buildPositionRecommendations(
  players: ImportedPlayer[],
  draftedPlayerIds: Iterable<string>,
  currentPick: number | null,
  limitPerPosition = 3,
  futureAssignedPlayerIds: Iterable<string> = [],
): PositionRecommendations[] {
  const drafted = new Set(draftedPlayerIds);
  const remainingPoolTimings = buildRemainingPoolTimings(
    players,
    drafted,
    currentPick,
    futureAssignedPlayerIds,
  );

  return BOARD_POSITIONS.map((position) => {
    const available = players
      .filter(
        (player) =>
          player.position === position &&
          Boolean(player.sleeperPlayerId) &&
          !drafted.has(player.sleeperPlayerId as string),
      )
      .sort(comparePlayers);

    return {
      position,
      availableCount: available.length,
      players: available.slice(0, Math.max(0, limitPerPosition)).map((player) => {
        const timing = remainingPoolTimings.get(player.boardPlayerId);
        return {
          player,
          sleeperExpectedPick: timing?.sleeperExpectedPick ?? null,
          countedAtPosition: timing?.countedAtPosition ?? 0,
          positionTiming:
            timing?.positionTiming ?? calculateModelPositionTiming(player.modelPositionRank, 0),
          modelTiming: timing?.modelTiming ?? null,
          sleeperTiming: timing?.sleeperTiming ?? null,
        };
      }),
    };
  });
}

export function buildRemainingPoolTimings(
  players: ImportedPlayer[],
  draftedPlayerIds: Iterable<string>,
  currentPick: number | null,
  futureAssignedPlayerIds: Iterable<string> = [],
): Map<string, RemainingPoolTiming> {
  const drafted = draftedPlayerIds instanceof Set ? draftedPlayerIds : new Set(draftedPlayerIds);
  const futureAssigned = new Set(futureAssignedPlayerIds);
  const available = players.filter(
    (player) => Boolean(player.sleeperPlayerId) && !drafted.has(player.sleeperPlayerId as string),
  );
  const sleeperPicks = buildDynamicPickMap(available, currentPick, "sleeperOverallAdp");
  const completedPickCount = [...drafted].filter(
    (playerId) => !futureAssigned.has(playerId),
  ).length;
  // Treat the best remaining market player as the shared overall frontier. Future
  // assignments ranked ahead of that player have already compressed the usable
  // draft pool, regardless of the physical pick at which the keeper is attached.
  const overallSleeperFrontier = minimumSleeperAdp(available);
  const countedOverall =
    completedPickCount +
    countFutureAssignmentsAhead(players, drafted, futureAssigned, overallSleeperFrontier);
  const countedByPosition = new Map<BoardPosition, number>(
    BOARD_POSITIONS.map((position) => {
      const completedAtPosition = players.filter((player) => {
        const sleeperPlayerId = player.sleeperPlayerId;
        return (
          player.position === position &&
          Boolean(sleeperPlayerId) &&
          drafted.has(sleeperPlayerId as string) &&
          !futureAssigned.has(sleeperPlayerId as string)
        );
      }).length;
      const positionSleeperFrontier = minimumSleeperAdp(
        available.filter((player) => player.position === position),
      );
      const assignedAhead = countFutureAssignmentsAhead(
        players.filter((player) => player.position === position),
        drafted,
        futureAssigned,
        positionSleeperFrontier,
      );
      return [position, completedAtPosition + assignedAhead];
    }),
  );

  return new Map(
    available.map((player) => {
      const sleeperExpectedPick = sleeperPicks.get(player.boardPlayerId) ?? null;
      const countedAtPosition = countedByPosition.get(player.position) ?? 0;
      const sleeperOverallRank = getSleeperOverallRank(player);
      const futureKeepersAhead = countFutureAssignmentsAheadOfPlayer(
        players,
        drafted,
        futureAssigned,
        sleeperOverallRank,
      );
      const keeperAdjustedSleeperRank = Math.max(1, sleeperOverallRank - futureKeepersAhead);
      return [
        player.boardPlayerId,
        {
          sleeperExpectedPick,
          countedAtPosition,
          countedOverall,
          positionTiming: calculateModelPositionTiming(player.modelPositionRank, countedAtPosition),
          modelTiming: calculateModelOverallTiming(player.modelOverallAdp, countedOverall),
          sleeperTiming: calculateSleeperOverallTiming(currentPick, keeperAdjustedSleeperRank),
        },
      ];
    }),
  );
}

function getSleeperOverallRank(player: ImportedPlayer): number {
  return player.sleeperOverallRank ?? player.sleeperOverallAdp;
}

function countFutureAssignmentsAheadOfPlayer(
  players: ImportedPlayer[],
  drafted: Set<string>,
  futureAssigned: Set<string>,
  sleeperOverallRank: number,
): number {
  return players.filter((player) => {
    const sleeperPlayerId = player.sleeperPlayerId;
    return (
      Boolean(sleeperPlayerId) &&
      drafted.has(sleeperPlayerId as string) &&
      futureAssigned.has(sleeperPlayerId as string) &&
      getSleeperOverallRank(player) < sleeperOverallRank
    );
  }).length;
}

function minimumSleeperAdp(players: ImportedPlayer[]): number | null {
  return players.length === 0
    ? null
    : Math.min(...players.map((player) => player.sleeperOverallAdp));
}

function countFutureAssignmentsAhead(
  players: ImportedPlayer[],
  drafted: Set<string>,
  futureAssigned: Set<string>,
  sleeperFrontier: number | null,
): number {
  if (sleeperFrontier === null) return 0;
  return players.filter((player) => {
    const sleeperPlayerId = player.sleeperPlayerId;
    return (
      Boolean(sleeperPlayerId) &&
      drafted.has(sleeperPlayerId as string) &&
      futureAssigned.has(sleeperPlayerId as string) &&
      player.sleeperOverallAdp < sleeperFrontier
    );
  }).length;
}

export function calculateModelPositionTiming(
  modelPositionRank: number,
  draftedAtPosition: number,
): PickTiming {
  return calculateRankTiming(modelPositionRank, draftedAtPosition, "position");
}

export function calculateModelOverallTiming(
  modelOverallAdp: number,
  countedOverall: number,
): PickTiming {
  return calculateRankTiming(modelOverallAdp, countedOverall, "overall");
}

function calculateRankTiming(
  modelRank: number,
  countedAhead: number,
  basis: "position" | "overall",
): PickTiming {
  const difference = countedAhead + 1 - modelRank;
  if (Math.abs(difference) < 0.05) return { kind: "value", picks: 0, basis };
  return {
    kind: difference < 0 ? "early" : "discount",
    picks: Math.abs(difference),
    basis,
  };
}

export function calculatePickTiming(
  currentPick: number | null,
  referenceAdp: number,
): PickTiming | null {
  if (currentPick === null) {
    return null;
  }

  const difference = currentPick - referenceAdp;
  if (Math.abs(difference) < 0.05) {
    return { kind: "value", picks: 0 };
  }

  return {
    kind: difference < 0 ? "early" : "discount",
    picks: Math.abs(difference),
  };
}

export function calculateSleeperOverallTiming(
  currentPick: number | null,
  keeperAdjustedSleeperRank: number,
): PickTiming | null {
  if (currentPick === null) return null;
  return calculateRankTiming(keeperAdjustedSleeperRank, currentPick - 1, "overall");
}

function comparePlayers(left: ImportedPlayer, right: ImportedPlayer): number {
  return (
    left.modelPositionRank - right.modelPositionRank ||
    left.modelOverallAdp - right.modelOverallAdp ||
    left.normalizedName.localeCompare(right.normalizedName)
  );
}

function buildDynamicPickMap(
  players: ImportedPlayer[],
  currentPick: number | null,
  adpField: "modelOverallAdp" | "sleeperOverallAdp",
): Map<string, number | null> {
  if (currentPick === null) {
    return new Map(players.map((player) => [player.boardPlayerId, null]));
  }

  const sorted = [...players].sort(
    (left, right) =>
      left[adpField] - right[adpField] || left.boardPlayerId.localeCompare(right.boardPlayerId),
  );
  const result = new Map<string, number | null>();
  let playersAhead = 0;

  sorted.forEach((player, index) => {
    if (index > 0 && player[adpField] > sorted[index - 1]![adpField]) {
      playersAhead = index;
    }
    result.set(player.boardPlayerId, currentPick + playersAhead);
  });

  return result;
}

import {
  buildRemainingPoolTimings,
  calculateModelPositionTiming,
  type PickTiming,
} from "../recommendations/recommendation-engine";
import type { ImportedPlayer } from "../types/board";
import type { OwnedDraftPick } from "../types/draft";

export type TargetActionKind = "waiting" | "consider_now" | "draft_now" | "trade_up";

export interface TargetAction {
  kind: TargetActionKind;
  earliestApprovedPick: number;
  sleeperExpectedPick: number;
  nextOwnedPick: OwnedDraftPick | null;
  tradeWindowStart: number | null;
  tradeWindowEnd: number | null;
}

export interface TargetRecommendation {
  player: ImportedPlayer;
  sleeperValuePick: number;
  sleeperExpectedPick: number | null;
  countedAtPosition: number;
  positionTiming: PickTiming;
  modelTiming: PickTiming | null;
  sleeperTiming: PickTiming | null;
  action: TargetAction | null;
}

export function buildTargetRecommendations(
  players: ImportedPlayer[],
  draftedPlayerIds: Iterable<string>,
  currentPick: number | null,
  upcomingOwnedPicks: OwnedDraftPick[] | null,
  limit = 3,
  reachTolerance = 0,
  futureAssignedPlayerIds: Iterable<string> = [],
): { availableCount: number; players: TargetRecommendation[] } {
  const drafted = new Set(draftedPlayerIds);
  const remainingPoolTimings = buildRemainingPoolTimings(
    players,
    drafted,
    currentPick,
    futureAssignedPlayerIds,
  );
  const available = players
    .filter(
      (player) =>
        player.isTarget &&
        Boolean(player.sleeperPlayerId) &&
        !drafted.has(player.sleeperPlayerId as string),
    )
    .sort(compareTargets);
  const fourthUpcomingOwnedPick = findFourthUpcomingOwnedPick(currentPick, upcomingOwnedPicks);
  const recommendations = available
    .map((player): TargetRecommendation => {
      const timing = remainingPoolTimings.get(player.boardPlayerId);
      return {
        player,
        sleeperValuePick: timing?.sleeperValuePick ?? getSleeperOverallRank(player),
        sleeperExpectedPick: timing?.sleeperExpectedPick ?? null,
        countedAtPosition: timing?.countedAtPosition ?? 0,
        positionTiming:
          timing?.positionTiming ?? calculateModelPositionTiming(player.modelPositionRank, 0),
        modelTiming: timing?.modelTiming ?? null,
        sleeperTiming: timing?.sleeperTiming ?? null,
        action:
          timing?.sleeperExpectedPick === null || timing?.sleeperExpectedPick === undefined
            ? null
            : calculateTargetAction(
                currentPick,
                timing.sleeperExpectedPick,
                upcomingOwnedPicks,
                reachTolerance,
              ),
      };
    })
    .sort((left, right) => {
      const priorityDifference =
        Number(isDeferredTarget(left, fourthUpcomingOwnedPick)) -
        Number(isDeferredTarget(right, fourthUpcomingOwnedPick));
      return priorityDifference || compareTargets(left.player, right.player);
    });

  return {
    availableCount: available.length,
    players: recommendations.slice(0, Math.max(0, limit)),
  };
}

function getSleeperOverallRank(player: ImportedPlayer): number {
  return player.sleeperOverallRank ?? player.sleeperOverallAdp;
}

function findFourthUpcomingOwnedPick(
  currentPick: number | null,
  upcomingOwnedPicks: OwnedDraftPick[] | null,
): number | null {
  if (currentPick === null || upcomingOwnedPicks === null) return null;
  return (
    [...upcomingOwnedPicks]
      .filter((pick) => pick.overallPick >= currentPick)
      .sort((left, right) => left.overallPick - right.overallPick)[3]?.overallPick ?? null
  );
}

function isDeferredTarget(
  recommendation: TargetRecommendation,
  fourthUpcomingOwnedPick: number | null,
): boolean {
  return (
    fourthUpcomingOwnedPick !== null &&
    recommendation.sleeperExpectedPick !== null &&
    recommendation.sleeperExpectedPick >= fourthUpcomingOwnedPick
  );
}

export function calculateTargetAction(
  currentPick: number | null,
  sleeperExpectedPick: number,
  upcomingOwnedPicks: OwnedDraftPick[] | null,
  reachTolerance = 0,
): TargetAction | null {
  if (currentPick === null || upcomingOwnedPicks === null) return null;

  const normalizedTolerance = Math.max(0, Math.floor(reachTolerance));
  const earliestApprovedPick = Math.max(
    currentPick,
    Math.ceil(sleeperExpectedPick - normalizedTolerance),
  );
  const currentOrNextOwnedPick =
    upcomingOwnedPicks.find((pick) => pick.overallPick >= currentPick) ?? null;
  const ownsCurrentPick = currentOrNextOwnedPick?.overallPick === currentPick;
  const followingOwnedPick =
    upcomingOwnedPicks.find((pick) => pick.overallPick > currentPick) ?? null;
  const tradeWindowStart = Math.max(currentPick, earliestApprovedPick);
  const latestMarketPick = Math.max(currentPick, Math.floor(sleeperExpectedPick + 1));
  const possibleWindowEnd = currentOrNextOwnedPick
    ? Math.min(currentOrNextOwnedPick.overallPick - 1, latestMarketPick)
    : null;
  const hasTradeWindow = possibleWindowEnd !== null && tradeWindowStart <= possibleWindowEnd;
  const atRiskBeforeNextPick =
    currentOrNextOwnedPick !== null && sleeperExpectedPick < currentOrNextOwnedPick.overallPick;
  const tradeWindowEnd = atRiskBeforeNextPick && hasTradeWindow ? possibleWindowEnd : null;

  let kind: TargetActionKind = "waiting";
  if (ownsCurrentPick && currentPick >= earliestApprovedPick) {
    kind = "draft_now";
  } else if (
    ownsCurrentPick &&
    followingOwnedPick !== null &&
    sleeperExpectedPick < followingOwnedPick.overallPick
  ) {
    kind = "consider_now";
  } else if (tradeWindowEnd !== null) {
    kind = "trade_up";
  }

  // Once an owned pick is active, it is the current decision rather than an
  // upcoming selection. A target that is still a Wait should reference the
  // user's following owned pick immediately, not after the current pick closes.
  const nextOwnedPick =
    ownsCurrentPick && (kind === "waiting" || kind === "consider_now")
      ? followingOwnedPick
      : currentOrNextOwnedPick;

  return {
    kind,
    earliestApprovedPick,
    sleeperExpectedPick,
    nextOwnedPick,
    tradeWindowStart: tradeWindowEnd === null ? null : tradeWindowStart,
    tradeWindowEnd,
  };
}

function compareTargets(left: ImportedPlayer, right: ImportedPlayer): number {
  return (
    left.modelOverallAdp - right.modelOverallAdp ||
    left.modelPositionRank - right.modelPositionRank ||
    left.normalizedName.localeCompare(right.normalizedName)
  );
}

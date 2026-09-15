import type {
  DraftSnapshot,
  OwnedDraftPick,
  SleeperDraft,
  SleeperTradedPick,
  SleeperUserIdentity,
  UserDraftIdentity,
} from "../types/draft";
import type { DraftPagePickOwnership } from "../shared/messages";

export function resolveUserDraftIdentity(
  draft: SleeperDraft,
  savedUser: SleeperUserIdentity | null,
): UserDraftIdentity | null {
  if (savedUser) {
    const draftSlot = draft.draftOrder[savedUser.userId];
    if (draftSlot) {
      return identity(savedUser, draft, draftSlot, false);
    }
  }

  const entries = Object.entries(draft.draftOrder);
  if (entries.length !== 1) {
    return null;
  }

  const [userId, draftSlot] = entries[0] as [string, number];
  return identity(
    { userId, username: "", displayName: `Draft slot ${draftSlot}` },
    draft,
    draftSlot,
    true,
  );
}

export function findUpcomingOwnedPicks(
  snapshot: DraftSnapshot,
  userIdentity: UserDraftIdentity,
  limit = 4,
  pagePickOwnership: DraftPagePickOwnership | null = null,
): OwnedDraftPick[] {
  if (snapshot.currentPick === null) {
    return [];
  }

  const occupied = new Set(snapshot.picks.map((pick) => pick.pickNumber));
  return buildDraftPickOwnership(
    snapshot.draft,
    snapshot.tradedPicks,
    userIdentity,
    pagePickOwnership,
  )
    .filter(
      (pick) =>
        pick.overallPick >= (snapshot.currentPick as number) && !occupied.has(pick.overallPick),
    )
    .slice(0, Math.max(0, limit));
}

export function buildDraftPickOwnership(
  draft: SleeperDraft,
  tradedPicks: SleeperTradedPick[],
  userIdentity: UserDraftIdentity,
  pagePickOwnership: DraftPagePickOwnership | null = null,
): OwnedDraftPick[] {
  const picks: OwnedDraftPick[] = [];
  const pageOwnedPicks = new Set(pagePickOwnership?.ownedPickNumbers ?? []);
  const pageTradedPicks = new Set(pagePickOwnership?.tradedPickNumbers ?? []);

  for (let round = 1; round <= draft.rounds; round += 1) {
    for (let positionInRound = 1; positionInRound <= draft.teams; positionInRound += 1) {
      const draftSlot = draftSlotFor(round, positionInRound, draft.teams, draft.type);
      const originalRosterId = draft.slotToRosterId[draftSlot] ?? null;
      const traded = findTrade(tradedPicks, round, originalRosterId);
      const overallPick = (round - 1) * draft.teams + positionInRound;
      const originallyOwned =
        userIdentity.rosterId === null
          ? draftSlot === userIdentity.draftSlot
          : originalRosterId === userIdentity.rosterId;
      let ownerRosterId: number | null = traded?.ownerId ?? originalRosterId;
      let isOwned =
        userIdentity.rosterId === null
          ? draftSlot === userIdentity.draftSlot && !traded
          : ownerRosterId === userIdentity.rosterId;

      if (pageOwnedPicks.has(overallPick)) {
        isOwned = true;
        ownerRosterId = userIdentity.rosterId;
      } else if (originallyOwned && pageTradedPicks.has(overallPick)) {
        isOwned = false;
      }

      if (isOwned) {
        picks.push({
          overallPick,
          round,
          pickInRound: positionInRound,
          draftSlot,
          originalRosterId,
          ownerRosterId,
          acquired:
            userIdentity.rosterId !== null &&
            originalRosterId !== null &&
            originalRosterId !== userIdentity.rosterId,
        });
      }
    }
  }

  return picks;
}

function draftSlotFor(
  round: number,
  positionInRound: number,
  teams: number,
  draftType: string,
): number {
  return draftType === "snake" && round % 2 === 0 ? teams - positionInRound + 1 : positionInRound;
}

function findTrade(
  tradedPicks: SleeperTradedPick[],
  round: number,
  originalRosterId: number | null,
): SleeperTradedPick | undefined {
  return originalRosterId === null
    ? undefined
    : tradedPicks.find(
        (pick) => pick.round === round && pick.originalRosterId === originalRosterId,
      );
}

function identity(
  user: SleeperUserIdentity,
  draft: SleeperDraft,
  draftSlot: number,
  automatic: boolean,
): UserDraftIdentity {
  return {
    user,
    draftSlot,
    rosterId: draft.slotToRosterId[draftSlot] ?? null,
    automatic,
  };
}

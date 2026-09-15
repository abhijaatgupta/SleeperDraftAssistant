export const DRAFT_PAGE_DETECTED = "SLEEPER_DRAFT_PAGE_DETECTED" as const;
export const GET_DRAFT_PAGE_CONTEXT = "SLEEPER_GET_DRAFT_PAGE_CONTEXT" as const;

export interface DraftPagePickOwnership {
  ownedPickNumbers: number[];
  tradedPickNumbers: number[];
  keeperPickNumbers: number[];
}

export interface DraftPageDetectedMessage {
  type: typeof DRAFT_PAGE_DETECTED;
  url: string;
  draftId: string | null;
  detectedAt: string;
  pickOwnership: DraftPagePickOwnership | null;
}

export interface GetDraftPageContextMessage {
  type: typeof GET_DRAFT_PAGE_CONTEXT;
}

export interface DraftPageContextResponse {
  url: string;
  draftId: string | null;
  pickOwnership: DraftPagePickOwnership | null;
}

export type ExtensionMessage = DraftPageDetectedMessage | GetDraftPageContextMessage;

export function isGetDraftPageContextMessage(value: unknown): value is GetDraftPageContextMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<GetDraftPageContextMessage>).type === GET_DRAFT_PAGE_CONTEXT
  );
}

export function isDraftPageDetectedMessage(value: unknown): value is DraftPageDetectedMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DraftPageDetectedMessage>;
  return (
    candidate.type === DRAFT_PAGE_DETECTED &&
    typeof candidate.url === "string" &&
    (typeof candidate.draftId === "string" || candidate.draftId === null) &&
    typeof candidate.detectedAt === "string" &&
    isDraftPagePickOwnership(candidate.pickOwnership)
  );
}

export function isDraftPagePickOwnership(value: unknown): value is DraftPagePickOwnership | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DraftPagePickOwnership>;
  return (
    isPositiveIntegerArray(candidate.ownedPickNumbers) &&
    isPositiveIntegerArray(candidate.tradedPickNumbers) &&
    (candidate.keeperPickNumbers === undefined ||
      isPositiveIntegerArray(candidate.keeperPickNumbers))
  );
}

function isPositiveIntegerArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "number" && Number.isInteger(item) && item > 0)
  );
}

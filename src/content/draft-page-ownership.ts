import type { DraftPagePickOwnership } from "../shared/messages";

const DRAFT_CELL_ID = /^draft-cell-(\d+)$/;

export function readDraftPagePickOwnership(root: ParentNode): DraftPagePickOwnership | null {
  const ownedPickNumbers: number[] = [];
  const tradedPickNumbers: number[] = [];
  const keeperPickNumbers: number[] = [];
  const cells = root.querySelectorAll<HTMLElement>(".cell[id^='draft-cell-']");

  for (const cell of cells) {
    const match = DRAFT_CELL_ID.exec(cell.id);
    if (!match) continue;

    const pickNumber = Number(match[1]);
    if (cell.querySelector(".keeper-icon")) {
      keeperPickNumbers.push(pickNumber);
    }

    const tradedMarker = cell.querySelector(".pick-traded");
    if (tradedMarker) {
      if (tradedMarker.classList.contains("own")) {
        ownedPickNumbers.push(pickNumber);
      } else {
        tradedPickNumbers.push(pickNumber);
      }
    }
  }

  return cells.length > 0
    ? {
        ownedPickNumbers: ownedPickNumbers.sort((left, right) => left - right),
        tradedPickNumbers: tradedPickNumbers.sort((left, right) => left - right),
        keeperPickNumbers: keeperPickNumbers.sort((left, right) => left - right),
      }
    : null;
}

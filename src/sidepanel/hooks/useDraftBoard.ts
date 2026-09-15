import { useCallback, useEffect, useRef, useState } from "react";
import { BoardImportError, readDraftBoardWorkbook } from "../../import/workbook-reader";
import { pickWorkbookFile } from "../../import/file-picker";
import { PLAYER_MATCHER_VERSION, matchBoardPlayers } from "../../matching/player-matcher";
import {
  playerCatalogService,
  type PlayerCatalogService,
} from "../../sleeper/player-catalog-service";
import { enrichBoardWithSleeperAdp } from "../../sleeper/adp-enrichment";
import { sleeperAdpService, type SleeperAdpService } from "../../sleeper/adp-service";
import { boardRepository, type BoardRepository } from "../../storage/board-repository";
import type { ImportIssue, StoredBoard } from "../../types/board";
import type { SleeperAdpFormat } from "../../types/sleeper";

export interface DraftBoardState {
  board: StoredBoard | null;
  loading: boolean;
  importing: boolean;
  matchingError: string | null;
  matchingWarning: string | null;
  adpFormat: SleeperAdpFormat;
  adpRefreshing: boolean;
  adpError: string | null;
  adpWarning: string | null;
  errors: ImportIssue[];
  importBoard: () => Promise<void>;
  retryPlayerMatching: () => Promise<void>;
}

export function useDraftBoard(
  season?: string,
  adpFormat: SleeperAdpFormat = "half_ppr",
  repository: BoardRepository = boardRepository,
  catalogService: PlayerCatalogService = playerCatalogService,
  adpService: SleeperAdpService = sleeperAdpService,
): DraftBoardState {
  const [board, setBoard] = useState<StoredBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const [matchingWarning, setMatchingWarning] = useState<string | null>(null);
  const [adpRefreshing, setAdpRefreshing] = useState(false);
  const [adpError, setAdpError] = useState<string | null>(null);
  const [adpWarning, setAdpWarning] = useState<string | null>(null);
  const [errors, setErrors] = useState<ImportIssue[]>([]);
  const lastAdpRequestKey = useRef<string | null>(null);
  const adpSeason = season?.trim() || String(new Date().getFullYear());

  const synchronizePlayerIds = useCallback(
    async (sourceBoard: StoredBoard): Promise<StoredBoard> => {
      setMatchingError(null);
      setMatchingWarning(null);

      try {
        const catalogResult = await catalogService.load();
        setMatchingWarning(catalogResult.warning ?? null);

        if (
          sourceBoard.matching?.matcherVersion === PLAYER_MATCHER_VERSION &&
          sourceBoard.matching.catalogFetchedAt === catalogResult.catalog.fetchedAt
        ) {
          return sourceBoard;
        }

        const result = matchBoardPlayers(sourceBoard, catalogResult.catalog);
        await repository.saveBoard(result.board);
        setBoard(result.board);
        return result.board;
      } catch (error) {
        setMatchingError(
          error instanceof Error ? error.message : "Sleeper player matching failed.",
        );
        return sourceBoard;
      }
    },
    [catalogService, repository],
  );

  useEffect(() => {
    let active = true;

    void repository
      .getActiveBoard()
      .then((storedBoard) => {
        if (active) {
          setBoard(storedBoard);
          if (storedBoard) {
            void synchronizePlayerIds(storedBoard);
          }
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setErrors([toUnexpectedIssue(error, "Stored draft board could not be loaded.")]);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [repository, synchronizePlayerIds]);

  useEffect(() => {
    if (loading || importing || !board || !board.players.some((player) => player.sleeperPlayerId)) {
      return;
    }

    const requestKey = `${board.boardId}:${board.matching?.matchedAt ?? "unmatched"}:${adpSeason}:${adpFormat}`;
    if (lastAdpRequestKey.current === requestKey) {
      return;
    }
    lastAdpRequestKey.current = requestKey;

    let active = true;
    setAdpRefreshing(true);
    setAdpError(null);
    setAdpWarning(null);

    void adpService
      .load(adpSeason, adpFormat)
      .then(async (snapshot) => {
        if (!active) {
          return;
        }

        const result = enrichBoardWithSleeperAdp(board, snapshot);
        await repository.saveBoard(result.board);
        if (!active) {
          return;
        }

        setBoard(result.board);
        if (result.missingPlayerNames.length > 0) {
          setAdpWarning(
            `Live Sleeper ADP was unavailable for ${formatPlayerNames(result.missingPlayerNames)}. Their last saved values are being used.`,
          );
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setAdpError(
            error instanceof Error
              ? error.message
              : "Live Sleeper ADP could not be refreshed. Last saved values are being used.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setAdpRefreshing(false);
        }
      });

    return () => {
      active = false;
    };
  }, [adpFormat, adpSeason, adpService, board, importing, loading, repository]);

  const importBoard = useCallback(async () => {
    setErrors([]);
    setMatchingError(null);
    setAdpError(null);
    setAdpWarning(null);

    try {
      const selectedWorkbook = await pickWorkbookFile();
      if (!selectedWorkbook) {
        return;
      }

      setImporting(true);
      const workbookBytes = await selectedWorkbook.file.arrayBuffer();
      const result = await readDraftBoardWorkbook(workbookBytes, selectedWorkbook.file.name);
      const catalogResult = await catalogService.load();
      setMatchingWarning(catalogResult.warning ?? null);
      const matchedBoard = matchBoardPlayers(result.board, catalogResult.catalog).board;
      const adpSnapshot = await adpService.load(adpSeason, adpFormat);
      const enriched = enrichBoardWithSleeperAdp(matchedBoard, adpSnapshot);
      await repository.replaceActiveBoard(enriched.board, selectedWorkbook.handle);
      lastAdpRequestKey.current = `${enriched.board.boardId}:${enriched.board.matching?.matchedAt ?? "unmatched"}:${adpSeason}:${adpFormat}`;
      setBoard(enriched.board);
      setAdpWarning(
        enriched.missingPlayerNames.length > 0
          ? `Live Sleeper ADP was unavailable for ${formatPlayerNames(enriched.missingPlayerNames)}. ADP-dependent values could not be completed for those players.`
          : null,
      );
    } catch (error) {
      if (error instanceof BoardImportError) {
        setErrors(error.issues.filter((issue) => issue.severity === "error"));
      } else {
        setErrors([toUnexpectedIssue(error, "Draft board import failed.")]);
      }
    } finally {
      setImporting(false);
    }
  }, [adpFormat, adpSeason, adpService, catalogService, repository]);

  const retryPlayerMatching = useCallback(async () => {
    if (board) {
      await synchronizePlayerIds(board);
    }
  }, [board, synchronizePlayerIds]);

  return {
    board,
    loading,
    importing,
    matchingError,
    matchingWarning,
    adpFormat,
    adpRefreshing,
    adpError,
    adpWarning,
    errors,
    importBoard,
    retryPlayerMatching,
  };
}

function formatPlayerNames(names: string[]): string {
  const visibleNames = names.slice(0, 4);
  const remainder = names.length - visibleNames.length;
  return remainder > 0
    ? `${visibleNames.join(", ")}, and ${remainder} more player(s)`
    : visibleNames.join(", ");
}

function toUnexpectedIssue(error: unknown, fallbackMessage: string): ImportIssue {
  return {
    severity: "error",
    code: "unexpected-error",
    message: error instanceof Error ? error.message : fallbackMessage,
  };
}

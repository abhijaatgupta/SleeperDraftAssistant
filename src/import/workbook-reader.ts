import {
  FIELD_LABELS,
  REQUIRED_BOARD_FIELDS,
  resolveBoardField,
  resolveRankingLabel,
  type BoardField,
} from "./board-schema";
import { normalizePlayerName } from "./normalize-player-name";
import { parseTargetValue } from "./target-parser";
import {
  BOARD_POSITIONS,
  type BoardImportResult,
  type BoardPosition,
  type ImportIssue,
  type ImportedPlayer,
} from "../types/board";

type WorkbookCell = string | number | boolean | Date | null | undefined;
type WorkbookRow = WorkbookCell[];
type ColumnMap = Partial<Record<BoardField, number>>;

const DRAFT_BOARD_SHEET = "Draft Board";
const IGNORED_POSITIONS = new Set(["K", "PK", "DEF", "DST", "D/ST"]);

export class BoardImportError extends Error {
  constructor(public readonly issues: ImportIssue[]) {
    super(issues[0]?.message ?? "The draft board could not be imported.");
    this.name = "BoardImportError";
  }
}

export async function readDraftBoardWorkbook(
  workbookBytes: ArrayBuffer,
  fileName: string,
  importedAt = new Date(),
): Promise<BoardImportResult> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(workbookBytes, {
    type: "array",
    cellDates: true,
  });
  const sheet = workbook.Sheets[DRAFT_BOARD_SHEET];

  if (!sheet) {
    throw new BoardImportError([
      {
        severity: "error",
        code: "missing-sheet",
        message: `Missing required worksheet: ${DRAFT_BOARD_SHEET}.`,
      },
    ]);
  }

  const rows = XLSX.utils.sheet_to_json<WorkbookRow>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });
  const headerRowIndex = findHeaderRow(rows);

  if (headerRowIndex === -1) {
    throw new BoardImportError([
      {
        severity: "error",
        code: "missing-header",
        message: "Could not find the Draft Board column headers in the first 25 rows.",
      },
    ]);
  }

  const issues: ImportIssue[] = [];
  const columns = buildColumnMap(rows[headerRowIndex] ?? [], issues, headerRowIndex + 1);
  const missingFields = REQUIRED_BOARD_FIELDS.filter((field) => columns[field] === undefined);

  if (columns.modelPositionRank === undefined && columns.modelOverallAdp === undefined) {
    throw new BoardImportError([
      ...issues,
      {
        severity: "error",
        code: "missing-model-ranking",
        message: "Include Model/User Pos Rank, Expected Overall ADP, or both.",
        row: headerRowIndex + 1,
      },
    ]);
  }

  if (missingFields.length > 0) {
    throw new BoardImportError([
      ...issues,
      ...missingFields.map((field) => ({
        severity: "error" as const,
        code: "missing-column",
        message: `Missing required column: ${FIELD_LABELS[field]}.`,
        row: headerRowIndex + 1,
      })),
    ]);
  }

  if (columns.isTarget === undefined) {
    issues.push({
      severity: "warning",
      code: "missing-target-column",
      message: "No target column was found. All players were imported as non-targets.",
      row: headerRowIndex + 1,
    });
  }

  const players: ImportedPlayer[] = [];
  const identities = new Map<string, number>();

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const sourceRow = index + 1;
    const name = readText(row, columns.name);

    if (!name) {
      continue;
    }

    const rawPosition = readText(row, columns.position).toUpperCase();

    if (rawPosition && IGNORED_POSITIONS.has(rawPosition)) {
      issues.push({
        severity: "warning",
        code: "ignored-position",
        message: `${name} was ignored because ${rawPosition} is outside the offensive draft board.`,
        row: sourceRow,
      });
      continue;
    }

    if (rawPosition && !isBoardPosition(rawPosition)) {
      issues.push({
        severity: "error",
        code: "invalid-position",
        message: `${name} has unsupported position “${rawPosition || "blank"}”.`,
        row: sourceRow,
      });
      continue;
    }

    const sourcePositionProvided = isBoardPosition(rawPosition);
    const position = sourcePositionProvided ? rawPosition : "WR";
    const team = readText(row, columns.team).toUpperCase();

    const providedModelPositionRank = readOptionalPositiveInteger(
      row,
      columns.modelPositionRank,
      FIELD_LABELS.modelPositionRank,
      name,
      sourceRow,
      issues,
    );
    const projectedPositionSos = readOptionalBoundedInteger(
      row,
      columns.projectedPositionSos,
      FIELD_LABELS.projectedPositionSos,
      name,
      sourceRow,
      issues,
      1,
      32,
    );
    const providedModelOverallAdp = readOptionalPositiveNumber(
      row,
      columns.modelOverallAdp,
      FIELD_LABELS.modelOverallAdp,
      name,
      sourceRow,
      issues,
    );

    if (
      providedModelPositionRank === null ||
      providedModelOverallAdp === null ||
      projectedPositionSos === null
    ) {
      continue;
    }

    if (providedModelPositionRank === undefined && providedModelOverallAdp === undefined) {
      issues.push(
        rowError(
          "missing-model-ranking",
          `${name} needs a Model/User Pos Rank, Expected Overall ADP, or both.`,
          sourceRow,
        ),
      );
      continue;
    }

    const modelPositionRank = providedModelPositionRank ?? providedModelOverallAdp ?? 1;
    const modelOverallAdp = providedModelOverallAdp ?? providedModelPositionRank ?? 1;

    const normalizedName = normalizePlayerName(name);
    const identity = `${sourcePositionProvided ? position : "PLAYER"}:${normalizedName}`;
    const duplicateRow = identities.get(identity);

    if (duplicateRow !== undefined) {
      issues.push(
        rowError(
          "duplicate-player",
          `${name} duplicates the player on row ${duplicateRow}.`,
          sourceRow,
        ),
      );
      continue;
    }

    identities.set(identity, sourceRow);
    const isTarget = parseTargetValue(readCell(row, columns.isTarget));

    const providedSleeperPlayerId = readSleeperPlayerId(
      row,
      columns.sleeperPlayerId,
      name,
      sourceRow,
      issues,
    );
    const sleeperPositionAdp = modelPositionRank;
    const sleeperOverallAdp = modelOverallAdp;

    players.push({
      boardPlayerId: identity,
      providedSleeperPlayerId,
      sleeperPlayerId: providedSleeperPlayerId,
      sourceRow,
      name,
      normalizedName,
      position,
      team,
      sourcePositionProvided,
      modelPositionRankProvided: providedModelPositionRank !== undefined,
      modelOverallAdpProvided: providedModelOverallAdp !== undefined,
      sleeperPositionAdp,
      modelPositionRank,
      ...(projectedPositionSos === undefined ? {} : { projectedPositionSos }),
      sleeperOverallAdp,
      modelOverallAdp,
      positionEdge: sleeperPositionAdp - modelPositionRank,
      overallEdge: sleeperOverallAdp - modelOverallAdp,
      isTarget,
    });
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    throw new BoardImportError(issues);
  }

  if (players.length === 0) {
    throw new BoardImportError([
      ...issues,
      {
        severity: "error",
        code: "empty-board",
        message: "The Draft Board worksheet did not contain any valid offensive players.",
      },
    ]);
  }

  const fileHash = await hashWorkbook(workbookBytes);
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const boardId = `board:${fileHash.slice(0, 24)}`;
  const metadata = {
    boardId,
    fileName,
    fileHash,
    importedAt: importedAt.toISOString(),
    playerCount: players.length,
    targetCount: players.filter((player) => player.isTarget).length,
    warningCount: warnings.length,
    rankingLabel:
      columns.modelPositionRank === undefined
        ? ("Model" as const)
        : (resolveRankingLabel(rows[headerRowIndex]?.[columns.modelPositionRank]) ?? "Model"),
  };
  const board = {
    boardId,
    metadata,
    players,
    warnings,
  };

  return { board, warnings };
}

function findHeaderRow(rows: WorkbookRow[]): number {
  const searchLimit = Math.min(rows.length, 25);

  for (let index = 0; index < searchLimit; index += 1) {
    const fields = new Set((rows[index] ?? []).map(resolveBoardField).filter(Boolean));
    if (fields.has("name")) {
      return index;
    }
  }

  return -1;
}

function buildColumnMap(
  headerRow: WorkbookRow,
  issues: ImportIssue[],
  sourceRow: number,
): ColumnMap {
  const columns: ColumnMap = {};

  headerRow.forEach((header, index) => {
    const field = resolveBoardField(header);
    if (!field) {
      return;
    }

    if (columns[field] !== undefined) {
      const existingRankingLabel = resolveRankingLabel(headerRow[columns[field]]);
      const duplicateRankingLabel = resolveRankingLabel(header);
      if (
        field === "modelPositionRank" &&
        existingRankingLabel !== null &&
        duplicateRankingLabel !== null &&
        existingRankingLabel !== duplicateRankingLabel
      ) {
        if (duplicateRankingLabel === "Model") columns[field] = index;
        issues.push({
          severity: "warning",
          code: "duplicate-column",
          message: "Both Model Pos Rank and User Pos Rank were found. Model Pos Rank was used.",
          row: sourceRow,
        });
        return;
      }
      issues.push({
        severity: "warning",
        code: "duplicate-column",
        message: `Duplicate ${FIELD_LABELS[field]} column was ignored.`,
        row: sourceRow,
      });
      return;
    }

    columns[field] = index;
  });

  return columns;
}

function readCell(row: WorkbookRow, column: number | undefined): WorkbookCell {
  return column === undefined ? null : row[column];
}

function readText(row: WorkbookRow, column: number | undefined): string {
  return String(readCell(row, column) ?? "").trim();
}

function readPositiveNumber(
  row: WorkbookRow,
  column: number | undefined,
  label: string,
  name: string,
  sourceRow: number,
  issues: ImportIssue[],
): number | null {
  const value = Number(readCell(row, column));
  if (!Number.isFinite(value) || value <= 0) {
    issues.push(rowError("invalid-number", `${name} has an invalid ${label}.`, sourceRow));
    return null;
  }
  return value;
}

function readPositiveInteger(
  row: WorkbookRow,
  column: number | undefined,
  label: string,
  name: string,
  sourceRow: number,
  issues: ImportIssue[],
): number | null {
  const value = readPositiveNumber(row, column, label, name, sourceRow, issues);
  if (value !== null && !Number.isInteger(value)) {
    issues.push(rowError("invalid-integer", `${name} has a non-integer ${label}.`, sourceRow));
    return null;
  }
  return value;
}

function readOptionalPositiveNumber(
  row: WorkbookRow,
  column: number | undefined,
  label: string,
  name: string,
  sourceRow: number,
  issues: ImportIssue[],
): number | undefined | null {
  const value = readCell(row, column);
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  return readPositiveNumber(row, column, label, name, sourceRow, issues);
}

function readOptionalPositiveInteger(
  row: WorkbookRow,
  column: number | undefined,
  label: string,
  name: string,
  sourceRow: number,
  issues: ImportIssue[],
): number | undefined | null {
  const value = readCell(row, column);
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  return readPositiveInteger(row, column, label, name, sourceRow, issues);
}

function readBoundedInteger(
  row: WorkbookRow,
  column: number | undefined,
  label: string,
  name: string,
  sourceRow: number,
  issues: ImportIssue[],
  minimum: number,
  maximum: number,
): number | null {
  const value = readPositiveInteger(row, column, label, name, sourceRow, issues);
  if (value !== null && (value < minimum || value > maximum)) {
    issues.push(
      rowError("out-of-range", `${name} has ${label} outside ${minimum}–${maximum}.`, sourceRow),
    );
    return null;
  }
  return value;
}

function readOptionalBoundedInteger(
  row: WorkbookRow,
  column: number | undefined,
  label: string,
  name: string,
  sourceRow: number,
  issues: ImportIssue[],
  minimum: number,
  maximum: number,
): number | undefined | null {
  const value = readCell(row, column);
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  return readBoundedInteger(row, column, label, name, sourceRow, issues, minimum, maximum);
}

function readSleeperPlayerId(
  row: WorkbookRow,
  column: number | undefined,
  name: string,
  sourceRow: number,
  issues: ImportIssue[],
): string | undefined {
  const rawValue = readCell(row, column);
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return undefined;
  }

  if (typeof rawValue === "number" && !Number.isSafeInteger(rawValue)) {
    issues.push({
      severity: "warning",
      code: "unsafe-sleeper-id",
      message: `${name} has a numeric Sleeper Player ID that Excel may have rounded.`,
      row: sourceRow,
    });
    return undefined;
  }

  return String(rawValue).trim() || undefined;
}

function isBoardPosition(value: string): value is BoardPosition {
  return BOARD_POSITIONS.some((position) => position === value);
}

function rowError(code: string, message: string, row: number): ImportIssue {
  return { severity: "error", code, message, row };
}

async function hashWorkbook(workbookBytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", workbookBytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

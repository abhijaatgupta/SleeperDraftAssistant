export function parseTargetValue(value: unknown): boolean {
  return String(value ?? "").trim().length > 0;
}

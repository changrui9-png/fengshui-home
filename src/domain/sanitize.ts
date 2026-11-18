const MAX_STRING = 2000;

export function cleanText(value: unknown, max = MAX_STRING): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, max);
}

export function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function optionalNumber(value: unknown, min: number, max: number): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
}

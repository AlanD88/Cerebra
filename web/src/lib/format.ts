/** Round a 0–1 fraction to a whole percent. */
export function pct(fraction: number): number {
  return Math.round(fraction * 100);
}

/** Signed whole-percent string, e.g. "+4%" / "−2%" / "0%". */
export function signedPct(fraction: number): string {
  const v = Math.round(fraction * 100);
  if (v > 0) return `+${v}%`;
  if (v < 0) return `−${Math.abs(v)}%`;
  return '0%';
}

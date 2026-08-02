/** Formatting helpers. */

export function money(value: number): string {
  const abs = Math.abs(value).toLocaleString('en-US')
  return value < 0 ? `-$${abs}` : `$${abs}`
}

/** Seconds → m:ss (legacy transport format). */
export function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/** Bytes → human-readable size: "812 B", "24 KB", "3.5 MB", "1.42 GB".
 * Rounds BEFORE picking the unit so 1023.9 KB tips into "1.0 MB" rather
 * than rendering as "1024 KB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const kb = bytes / 1024
  if (Math.round(kb) < 1024) return `${Math.round(kb)} KB`
  const mb = kb / 1024
  if (Number(mb.toFixed(1)) < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

export function truncate(text: string, max: number): string {
  // Slice by code points, not UTF-16 units — string.slice can split an
  // emoji's surrogate pair in half and render mojibake.
  const chars = Array.from(text)
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : text
}

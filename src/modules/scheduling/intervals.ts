/** Half-open interval [start, end). Units are whatever the caller uses (minutes or ms). */
export interface Interval {
  start: number;
  end: number;
}

/** Half-open overlap: [a,b) and [c,d) overlap iff a < d && c < b. Touching ends do not overlap. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function contains(outer: Interval, inner: Interval): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

/** Sort and merge overlapping/adjacent intervals; drops empty ones. */
export function normalize(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => i.end > i.start).sort((x, y) => x.start - y.start);
  const out: Interval[] = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (last && cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else out.push({ ...cur });
  }
  return out;
}

export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const A = normalize(a);
  const B = normalize(b);
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    const x = A[i]!;
    const y = B[j]!;
    const start = Math.max(x.start, y.start);
    const end = Math.min(x.end, y.end);
    if (end > start) out.push({ start, end });
    if (x.end < y.end) i++;
    else j++;
  }
  return out;
}

export function subtract(from: Interval[], remove: Interval[]): Interval[] {
  let result = normalize(from);
  for (const r of normalize(remove)) {
    const next: Interval[] = [];
    for (const f of result) {
      if (!overlaps(f, r)) {
        next.push(f);
        continue;
      }
      if (r.start > f.start) next.push({ start: f.start, end: r.start });
      if (r.end < f.end) next.push({ start: r.end, end: f.end });
    }
    result = next;
  }
  return result;
}

/** Validate a list of minute periods for one day (used by the availability editor). */
export function validateDayPeriods(periods: Interval[]): 'end_before_start' | 'overlap' | null {
  for (const p of periods) if (p.end <= p.start) return 'end_before_start';
  const sorted = [...periods].sort((a, b) => a.start - b.start);
  for (let k = 1; k < sorted.length; k++)
    if (sorted[k]!.start < sorted[k - 1]!.end) return 'overlap';
  return null;
}

/** Something drawn in a calendar column, between two instants. */
export interface Span {
  readonly id: string;
  readonly start: Date;
  readonly end: Date;
}

/** Where a span sits in its column: its lane among `lanes` side-by-side lanes. */
export interface Placement {
  readonly lane: number;
  readonly lanes: number;
}

/**
 * Side-by-side lanes for spans that overlap in one column, such as an appointment and the block it collides with,
 * or several members' appointments in a week column. Each group of overlapping spans shares its lane count.
 */
export function placeInLanes(spans: readonly Span[]): Map<string, Placement> {
  const sorted = [...spans].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime(),
  );
  const placements = new Map<string, Placement>();
  let group: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;

  const closeGroup = () => {
    for (const { id, lane } of group) placements.set(id, { lane, lanes: laneEnds.length });
    group = [];
    laneEnds = [];
  };

  for (const span of sorted) {
    const start = span.start.getTime();
    if (start >= groupEnd) closeGroup();
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane === -1) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = span.end.getTime();
    group.push({ id: span.id, lane });
    groupEnd = group.length === 1 ? span.end.getTime() : Math.max(groupEnd, span.end.getTime());
  }
  closeGroup();
  return placements;
}

/** The hours a grid shows: 08:00 to 20:00, widened to whole hours around anything outside them. */
export function visibleHours(minutesOfDay: readonly number[]): { first: number; last: number } {
  const earliest = Math.min(8 * 60, ...minutesOfDay);
  const latest = Math.max(20 * 60, ...minutesOfDay);
  return { first: Math.floor(earliest / 60), last: Math.min(24, Math.ceil(latest / 60)) };
}

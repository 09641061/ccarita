import { placeInLanes, visibleHours } from './grid-layout';

const at = (hhmm: string) => new Date(`2026-10-23T${hhmm}:00Z`);
const span = (id: string, start: string, end: string) => ({ id, start: at(start), end: at(end) });

describe('placeInLanes', () => {
  it('keeps spans that do not overlap in one full-width lane', () => {
    const lanes = placeInLanes([span('a', '09:00', '09:45'), span('b', '09:45', '10:30')]);
    expect(lanes.get('a')).toEqual({ lane: 0, lanes: 1 });
    expect(lanes.get('b')).toEqual({ lane: 0, lanes: 1 });
  });

  it('puts overlapping spans side by side and reuses freed lanes', () => {
    const lanes = placeInLanes([
      span('a', '09:00', '10:00'),
      span('b', '09:30', '10:30'),
      span('c', '10:00', '11:00'),
      span('d', '12:00', '12:30'),
    ]);
    expect(lanes.get('a')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('b')).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get('c')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('d')).toEqual({ lane: 0, lanes: 1 });
  });
});

describe('visibleHours', () => {
  it('shows 08:00 to 20:00 by default and widens to whole hours', () => {
    expect(visibleHours([])).toEqual({ first: 8, last: 20 });
    expect(visibleHours([7 * 60 + 30, 21 * 60 + 15])).toEqual({ first: 7, last: 22 });
  });
});

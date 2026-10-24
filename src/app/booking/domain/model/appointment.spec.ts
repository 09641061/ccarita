import { appointment } from '../../../../testing/booking-fixtures';

describe('Appointment', () => {
  const beforeStart = new Date('2026-10-23T16:59:00Z');
  const atStart = new Date('2026-10-23T17:00:00Z');

  it('B10: completed, cancelled and no-show are final and allow nothing', () => {
    for (const status of ['completed', 'cancelled', 'no_show'] as const) {
      const a = appointment(status);
      expect(a.isFinal).toBe(true);
      expect([a.canStart, a.canComplete, a.canCancel, a.canReschedule]).toEqual([
        false,
        false,
        false,
        false,
      ]);
      expect(a.canMarkNoShow(atStart)).toBe(false);
    }
  });

  it('B10: a confirmed appointment starts, completes or is cancelled', () => {
    const a = appointment('confirmed');
    expect([a.isFinal, a.canStart, a.canComplete, a.canCancel]).toEqual([false, true, true, true]);
  });

  it('B10: an appointment in progress completes or is cancelled, but does not start again', () => {
    const a = appointment('in_progress');
    expect([a.canStart, a.canComplete, a.canCancel]).toEqual([false, true, true]);
    expect(a.canMarkNoShow(atStart)).toBe(false);
  });

  it('B11: no-show only from the start time', () => {
    expect(appointment('confirmed').canMarkNoShow(beforeStart)).toBe(false);
    expect(appointment('confirmed').canMarkNoShow(atStart)).toBe(true);
  });

  it('B13: only confirmed appointments are rescheduled', () => {
    expect(appointment('confirmed').canReschedule).toBe(true);
    expect(appointment('in_progress').canReschedule).toBe(false);
  });

  it('B5: only confirmed and in-progress appointments hold time', () => {
    expect(appointment('confirmed').occupiesTime).toBe(true);
    expect(appointment('in_progress').occupiesTime).toBe(true);
    expect(appointment('cancelled').occupiesTime).toBe(false);
  });
});

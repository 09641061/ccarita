import { ZonedDatePipe } from './zoned-date.pipe';
import { LocalDate } from '../../domain/model/local-date';

describe('ZonedDatePipe', () => {
  const pipe = new ZonedDatePipe();
  // 03:30 UTC on 7 Nov is 22:30 on 6 Nov in Lima and 23:30 on 6 Nov in Santiago.
  const instant = new Date('2026-11-07T03:30:00Z');

  it('shows the date in the given time zone, not the device one', () => {
    expect(pipe.transform(instant, 'America/Lima')).toBe('6 nov. 2026');
    expect(pipe.transform(instant, 'Asia/Tokyo')).toBe('7 nov. 2026');
  });

  it('shows 24-hour times', () => {
    expect(pipe.transform(instant, 'America/Lima', 'time')).toBe('22:30');
  });
});

describe('ZonedDatePipe with a local date', () => {
  const pipe = new ZonedDatePipe();

  it('names the day itself, whatever the zone', () => {
    const day = LocalDate.parse('2026-10-23');
    expect(pipe.transform(day, 'America/Lima', 'longDay')).toBe('viernes, 23 de octubre');
    expect(pipe.transform(day, 'Asia/Tokyo', 'weekday')).toBe('vie');
    expect(pipe.transform(day, 'America/Lima', 'monthYear')).toBe('octubre de 2026');
    expect(pipe.transform(day, 'America/Lima', 'shortDay')).toBe('vie, 23 oct.');
  });
});

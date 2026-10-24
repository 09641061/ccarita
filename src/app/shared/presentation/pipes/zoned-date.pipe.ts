import { Pipe, PipeTransform } from '@angular/core';
import { LocalDate } from '../../domain/model/local-date';

export type ZonedDateFormat = 'date' | 'time' | 'dayTime' | 'weekday' | 'dayMonth' | 'longDay';

const FORMATS: Record<ZonedDateFormat, Intl.DateTimeFormatOptions> = {
  date: { day: 'numeric', month: 'short', year: 'numeric' },
  time: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  dayTime: {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  },
  weekday: { weekday: 'short' },
  dayMonth: { day: 'numeric', month: 'short' },
  longDay: { weekday: 'long', day: 'numeric', month: 'long' },
};

/**
 * An instant, or a day of the establishment, in its IANA time zone (`America/Lima`), never the device's:
 * `{{ a.start | zonedDate: tz : 'dayTime' }}`. Angular's `DatePipe` ignores IANA names.
 */
@Pipe({ name: 'zonedDate' })
export class ZonedDatePipe implements PipeTransform {
  transform(value: Date | LocalDate, timeZone: string, format: ZonedDateFormat = 'date'): string {
    const instant = value instanceof LocalDate ? value.atTime('12:00', timeZone) : value;
    return new Intl.DateTimeFormat('es-PE', { ...FORMATS[format], timeZone }).format(instant);
  }
}

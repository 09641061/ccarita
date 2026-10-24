import { Pipe, PipeTransform } from '@angular/core';

export type ZonedDateFormat = 'date' | 'time' | 'dayTime';

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
};

/**
 * An instant in the establishment's IANA time zone (`America/Lima`), never the device's:
 * `{{ a.start | zonedDate: tz : 'dayTime' }}`. Angular's `DatePipe` ignores IANA names.
 */
@Pipe({ name: 'zonedDate' })
export class ZonedDatePipe implements PipeTransform {
  transform(value: Date, timeZone: string, format: ZonedDateFormat = 'date'): string {
    return new Intl.DateTimeFormat('es-PE', { ...FORMATS[format], timeZone }).format(value);
  }
}

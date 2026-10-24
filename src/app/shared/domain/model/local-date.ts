const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/**
 * A calendar day of an establishment (`2026-10-23`), as pibble's `LocalDate`. It turns into instants only through
 * an IANA time zone, never the device's, so a day in Lima stays that day on any computer.
 */
export class LocalDate {
  private constructor(
    readonly year: number,
    readonly month: number,
    readonly day: number,
  ) {}

  /** @throws Error when the text is not a real `YYYY-MM-DD` day. */
  static parse(text: string): LocalDate {
    const match = PATTERN.exec(text);
    if (!match) throw new Error(`Not a local date: ${text}`);
    const date = LocalDate.fromUtc(Date.UTC(+match[1], +match[2] - 1, +match[3]));
    if (date.toString() !== text) throw new Error(`Not a local date: ${text}`);
    return date;
  }

  /** The day `instant` falls on in `timeZone`. */
  static of(instant: Date, timeZone: string): LocalDate {
    const parts = wallClock(instant, timeZone);
    return new LocalDate(parts.year, parts.month, parts.day);
  }

  plusDays(days: number): LocalDate {
    return LocalDate.fromUtc(this.utcMidnight() + days * DAY_MS);
  }

  /** 0 for Monday through 6 for Sunday. */
  get weekday(): number {
    return (new Date(this.utcMidnight()).getUTCDay() + 6) % 7;
  }

  /** The Monday of this day's week. */
  startOfWeek(): LocalDate {
    return this.plusDays(-this.weekday);
  }

  /** The instant this day starts in `timeZone`. */
  startIn(timeZone: string): Date {
    return this.atTime('00:00', timeZone);
  }

  /**
   * The instant of a wall-clock time (`09:30`) on this day in `timeZone`. A time skipped by a daylight-saving jump
   * resolves to the instant after the jump.
   */
  atTime(time: string, timeZone: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const wall = this.utcMidnight() + (hours * 60 + minutes) * 60_000;
    const first = wall - offset(new Date(wall), timeZone);
    const second = wall - offset(new Date(first), timeZone);
    return new Date(second);
  }

  equals(other: LocalDate | null | undefined): boolean {
    return other?.toString() === this.toString();
  }

  isBefore(other: LocalDate): boolean {
    return this.utcMidnight() < other.utcMidnight();
  }

  toString(): string {
    const pad = (n: number, width = 2) => String(n).padStart(width, '0');
    return `${pad(this.year, 4)}-${pad(this.month)}-${pad(this.day)}`;
  }

  private utcMidnight(): number {
    return Date.UTC(this.year, this.month - 1, this.day);
  }

  private static fromUtc(ms: number): LocalDate {
    const date = new Date(ms);
    return new LocalDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
}

/** The wall-clock time of `instant` in `timeZone` as `HH:mm`. */
export function localTimeOf(instant: Date, timeZone: string): string {
  const { hour, minute } = wallClock(instant, timeZone);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function wallClock(instant: Date, timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts['year'],
    month: parts['month'],
    day: parts['day'],
    hour: parts['hour'],
    minute: parts['minute'],
    second: parts['second'],
  };
}

/** Milliseconds `timeZone` is ahead of UTC at `instant`. */
function offset(instant: Date, timeZone: string): number {
  const p = wallClock(instant, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(instant.getTime() / 1000) * 1000;
}

import { LocalDate } from '../../../shared/domain/model/local-date';
import { UsagePeriod } from '../../../shared/domain/model/usage-period';
import { AssistantUsage } from './assistant-usage';

const day = (text: string) => LocalDate.parse(text);
const lima = 'America/Lima';

describe('AssistantUsage', () => {
  const totals = (turns: number) => ({
    turns,
    inputTokens: turns * 100,
    cachedTokens: 0,
    outputTokens: turns * 10,
    toolCalls: turns,
  });
  const period = UsagePeriod.of(day('2026-10-20'), day('2026-10-26'));

  it('lists the days with turns newest first', () => {
    const usage = new AssistantUsage(period, lima, totals(3), [
      { date: day('2026-10-21'), totals: totals(1) },
      { date: day('2026-10-23'), totals: totals(2) },
    ]);
    expect(usage.newestFirst.map((d) => d.date.toString())).toEqual(['2026-10-23', '2026-10-21']);
    expect(usage.isEmpty).toBe(false);
  });

  it('is empty when nothing was answered', () => {
    expect(new AssistantUsage(period, lima, totals(0), []).isEmpty).toBe(true);
  });
});

import { TestBed } from '@angular/core/testing';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { Slot } from '../../../domain/model/slot';
import { SLOTS_SHOWN, SlotPicker } from './slot-picker';

// Every 15 minutes from 09:00 to 15:45 in Lima: 12 in the morning, 16 in the afternoon.
const SLOTS = Array.from({ length: 28 }, (_, i) => {
  const start = new Date(Date.UTC(2026, 9, 23, 14, i * 15));
  return new Slot(start, new Date(start.getTime() + 45 * 60_000), i % 2 ? ['m-1'] : ['m-1', 'm-2']);
});

describe('SlotPicker', () => {
  async function render(selected: Slot | null = null) {
    TestBed.configureTestingModule({ providers: [provideSpanish()] });
    const fixture = TestBed.createComponent(SlotPicker);
    fixture.componentRef.setInput('slots', SLOTS);
    fixture.componentRef.setInput('timeZone', 'America/Lima');
    fixture.componentRef.setInput('selected', selected);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }
  const times = (host: HTMLElement, part: number) =>
    [...host.querySelectorAll('.group')[part].querySelectorAll('.slot')].map((b) =>
      b.textContent!.trim().slice(0, 5),
    );

  it('groups the morning and the afternoon and shows how many are free', async () => {
    const { host } = await render();
    expect([...host.querySelectorAll('h3')].map((h) => h.textContent!.trim())).toEqual([
      'Mañana',
      'Tarde',
    ]);
    expect(times(host, 0)).toHaveLength(SLOTS_SHOWN);
    expect(times(host, 0)[0]).toBe('09:00');
    expect(times(host, 1)[0]).toBe('12:00');
    expect(host.querySelector('.slot')!.textContent).toContain('2 libres');
    expect(host.querySelectorAll('.slot')[1].textContent).toContain('1 libre');
  });

  it('shows the rest of a part on request', async () => {
    const { fixture, host } = await render();
    const more = host.querySelector<HTMLButtonElement>('.more')!;
    expect(more.textContent).toContain('Ver toda la mañana (4 más)');
    more.click();
    await fixture.whenStable();
    expect(times(host, 0)).toHaveLength(12);
  });

  it('keeps the chosen time visible and marks it', async () => {
    const { host } = await render(SLOTS[10]);
    const chosen = host.querySelector('[aria-checked="true"]')!;
    expect(chosen.textContent).toContain('11:30');
  });

  it('reports the chosen time', async () => {
    const { fixture, host } = await render();
    const choose = vi.fn();
    fixture.componentInstance.choose.subscribe(choose);
    host.querySelector<HTMLButtonElement>('.slot')!.click();
    expect(choose).toHaveBeenCalledWith(SLOTS[0]);
  });
});

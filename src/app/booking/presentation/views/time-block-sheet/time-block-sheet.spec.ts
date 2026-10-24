import { TestBed } from '@angular/core/testing';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { Member } from '../../../../organization/public-api';
import { LocalDate } from '../../../../shared/domain/model/local-date';
import { CalendarStore } from '../../../application/calendar.store';
import { TimeBlockSheet, TimeBlockSheetData } from './time-block-sheet';

const kevin = new Member('m-2', 'kevin@example.com', 'Kevin', 'staff', true, 'active', ['est-1']);

describe('TimeBlockSheet', () => {
  let createTimeBlock: ReturnType<typeof vi.fn>;
  let dismiss: ReturnType<typeof vi.fn>;

  async function render(data: Partial<TimeBlockSheetData> = {}) {
    createTimeBlock = vi.fn().mockResolvedValue({});
    dismiss = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        { provide: CalendarStore, useValue: { createTimeBlock } },
        { provide: MatBottomSheetRef, useValue: { dismiss } },
        {
          provide: MAT_BOTTOM_SHEET_DATA,
          useValue: {
            day: LocalDate.parse('2026-10-23'),
            timeZone: 'America/Lima',
            members: [kevin],
            memberId: 'm-2',
            managesEveryone: false,
            ...data,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(TimeBlockSheet);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  const set = (host: HTMLElement, type: 'date' | 'time', index: number, value: string) => {
    const input = host.querySelectorAll<HTMLInputElement>(`input[type="${type}"]`)[index];
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const submit = async (fixture: { detectChanges(): void }, host: HTMLElement) => {
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    fixture.detectChanges();
  };

  it('B15: staff block their own time, in the establishment zone', async () => {
    const { fixture, host } = await render();
    expect(host.querySelector('mat-select')).toBeNull();

    set(host, 'time', 0, '18:00');
    set(host, 'time', 1, '19:30');
    await submit(fixture, host);

    const [command, key] = createTimeBlock.mock.calls[0];
    expect(command).toEqual({
      staffMemberId: 'm-2',
      start: new Date('2026-10-23T23:00:00Z'),
      end: new Date('2026-10-24T00:30:00Z'),
      reason: null,
    });
    expect(key).toEqual(expect.any(String));
    expect(dismiss).toHaveBeenCalledWith(true);
  });

  it('refuses an end before the start', async () => {
    const { fixture, host } = await render();
    set(host, 'date', 1, '2026-10-22');
    await submit(fixture, host);

    expect(createTimeBlock).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('después del inicio');
  });

  it('B15: owners and managers may block the whole establishment', async () => {
    const { fixture, host } = await render({ managesEveryone: true, memberId: null });
    expect(host.querySelector('mat-select')).not.toBeNull();

    await submit(fixture, host);
    expect(createTimeBlock.mock.calls[0][0].staffMemberId).toBeNull();
  });
});

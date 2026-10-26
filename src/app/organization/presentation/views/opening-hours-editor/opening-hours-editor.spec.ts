import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { OpeningHoursStore } from '../../../application/opening-hours.store';
import { MemberAction, MemberRole, canPerform } from '../../../domain/model/member-role';
import { OpeningHours } from '../../../domain/model/opening-hours';
import { OpeningHoursEditor } from './opening-hours-editor';

const WEEK = new OpeningHours([
  { weekday: 1, opensAt: '09:00', closesAt: '13:00' },
  { weekday: 1, opensAt: '15:00', closesAt: '19:00' },
  { weekday: 6, opensAt: '10:00', closesAt: '14:00' },
]);

describe('OpeningHoursEditor', () => {
  let hours: ReturnType<typeof fakeResource<OpeningHours>>;
  let replace: ReturnType<typeof vi.fn>;

  async function render(
    initial: OpeningHours | null = WEEK,
    options: { role?: MemberRole; planActive?: boolean } = {},
  ) {
    hours = fakeResource(initial ?? undefined);
    replace = vi.fn(async (_id: string, week: OpeningHours) => week);
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        { provide: OpeningHoursStore, useValue: { hours, replace } },
        {
          provide: CurrentOrganization,
          useValue: {
            can: (action: MemberAction) => canPerform(options.role ?? 'manager', action),
            planActive: signal(options.planActive ?? true),
          },
        },
        { provide: CurrentEstablishment, useValue: { id: signal('est-1') } },
      ],
    });
    const fixture = TestBed.createComponent(OpeningHoursEditor);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const stable = async () => {
      await settle();
      await fixture.whenStable();
    };
    return { host, stable };
  }

  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');
  const days = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>('.day')];
  const times = (day: HTMLElement) =>
    [...day.querySelectorAll<HTMLInputElement>('input[type="time"]')].map((input) => input.value);
  const button = (host: HTMLElement, label: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent!.includes(label),
    )!;
  const setTime = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('change'));
  };

  it('O8: shows each day closed or with its ranges', async () => {
    const { host } = await render();
    expect(days(host)).toHaveLength(7);
    expect(times(days(host)[0])).toEqual(['09:00', '13:00', '15:00', '19:00']);
    expect(days(host)[1].textContent).toContain('Cerrado');
    expect(times(days(host)[5])).toEqual(['10:00', '14:00']);
  });

  it('O8: shows an overlap and does not save it', async () => {
    const { host, stable } = await render();
    setTime(days(host)[0].querySelectorAll<HTMLInputElement>('input')[2], '12:00');
    await stable();
    expect(text(host)).toContain('Se cruza con otro turno del día.');

    button(host, 'Guardar horario').click();
    await stable();
    expect(replace).not.toHaveBeenCalled();
  });

  it('saves the whole week with a PUT', async () => {
    const { host, stable } = await render();
    [...days(host)[5].querySelectorAll('button')]
      .find((b) => b.textContent!.includes('Agregar turno'))!
      .click();
    await stable();
    const saturday = days(host)[5].querySelectorAll<HTMLInputElement>('input');
    setTime(saturday[2], '16:00');
    setTime(saturday[3], '20:00');
    await stable();
    button(host, 'Guardar horario').click();
    await stable();

    const [id, week] = replace.mock.calls[0] as [string, OpeningHours];
    expect(id).toBe('est-1');
    expect(week.on(6).map((r) => [r.opensAt, r.closesAt])).toEqual([
      ['10:00', '14:00'],
      ['16:00', '20:00'],
    ]);
    expect(week.on(1)).toHaveLength(2);
    expect(text(host)).toContain('Horario guardado.');
  });

  it('opens a day with the previous open day’s ranges', async () => {
    const { host, stable } = await render();
    days(host)[1].querySelector<HTMLButtonElement>('mat-slide-toggle button')!.click();
    await stable();
    expect(times(days(host)[1])).toEqual(['09:00', '13:00', '15:00', '19:00']);
  });

  it('says a new establishment takes no appointments until its hours are set', async () => {
    const { host } = await render(new OpeningHours([]));
    expect(text(host)).toContain('por ahora no recibe citas');
  });

  it('shows pibble’s refusal next to the action', async () => {
    const { host, stable } = await render();
    replace.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', ''));
    button(host, 'Guardar horario').click();
    await stable();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain('Revisa los datos');
  });

  it('offers a retry when the hours cannot be read', async () => {
    const { host } = await render(null);
    expect(host.querySelector('app-skeleton')).not.toBeNull();
    hours.error.set(new ApiError(0, 'NETWORK_ERROR', ''));
    TestBed.tick();
    button(host, 'Reintentar').click();
    expect(hours.reload).toHaveBeenCalled();
  });

  it('O6: disables changes while the plan is inactive', async () => {
    const { host } = await render(WEEK, { planActive: false });
    expect(button(host, 'Guardar horario').disabled).toBe(true);
    expect(days(host)[0].querySelector('input')!.disabled).toBe(true);
  });

  it('03 §5: staff cannot change the hours', async () => {
    const { host } = await render(WEEK, { role: 'staff' });
    expect(text(host)).toContain('no está disponible para tu rol');
  });
});

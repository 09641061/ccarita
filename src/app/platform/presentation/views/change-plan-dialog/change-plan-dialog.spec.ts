import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { OrganizationAccountStore } from '../../../application/organization-account.store';
import { OrganizationAccount } from '../../../domain/model/organization-account';
import { ChangePlanDialog } from './change-plan-dialog';

const NOW = new Date('2026-10-26T15:00:00Z');
const MAX_TWO_PLACES = new OrganizationAccount(
  'org-1',
  'Barbería Don Lucho',
  'max',
  new Date('2026-11-06T05:00:00Z'),
  true,
  'luis@donlucho.pe',
  2,
);

describe('ChangePlanDialog', () => {
  let changePlan: ReturnType<typeof vi.fn>;
  let dismiss: ReturnType<typeof vi.fn>;

  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'], now: NOW }));
  afterEach(() => vi.useRealTimers());

  async function render() {
    changePlan = vi.fn(async () => ({ id: 'pc-1' }));
    dismiss = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        { provide: OrganizationAccountStore, useValue: { changePlan } },
        { provide: MatDialogRef, useValue: { close: dismiss } },
        { provide: MAT_DIALOG_DATA, useValue: MAX_TWO_PLACES },
      ],
    });
    const fixture = TestBed.createComponent(ChangePlanDialog);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const text = () => host.textContent!.replace(/\s+/g, ' ');
    const radio = async (label: string) => {
      const target = [...host.querySelectorAll('mat-radio-button')].find((r) =>
        r.textContent!.includes(label),
      )!;
      target.querySelector<HTMLInputElement>('input')!.click();
      await fixture.whenStable();
    };
    const type = async (selector: string, value: string) => {
      const field = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
      field.value = value;
      field.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const submit = async () => {
      host.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle();
      await fixture.whenStable();
    };
    return { host, text, radio, type, submit };
  }

  it('O5: extends 30 days from the current end and previews it in Lima', async () => {
    const { text, type, submit } = await render();
    expect(text()).toContain('Quedará activo hasta el dom, 6 dic., 00:00 (hora de Lima).');

    await submit();
    expect(changePlan).not.toHaveBeenCalled();
    expect(text()).toContain('Escribe una nota.');

    await type('textarea', 'Yape 2026-10-23');
    await submit();
    expect(changePlan).toHaveBeenCalledWith(
      { plan: null, period: { kind: 'extend', days: 30 }, note: 'Yape 2026-10-23' },
      expect.any(String),
    );
    expect(dismiss).toHaveBeenCalledWith({ id: 'pc-1' });
  });

  it('O4: warns that a downgrade leaves the extra establishment open', async () => {
    const { text, radio, type, submit } = await render();
    await radio('Standard');
    expect(text()).toContain('Tiene 2 locales abiertos. Seguirán abiertos');
    await radio('No cambiar la fecha');
    await type('textarea', 'Bajó de plan');
    await submit();
    expect(changePlan.mock.calls[0][0]).toEqual({
      plan: 'standard',
      period: { kind: 'keep' },
      note: 'Bajó de plan',
    });
  });

  it('refuses a change of nothing before calling pibble', async () => {
    const { text, radio, type, submit } = await render();
    await radio('No cambiar la fecha');
    await type('textarea', 'Nada');
    await submit();
    expect(changePlan).not.toHaveBeenCalled();
    expect(text()).toContain('así no cambia nada');
  });

  it('stops the plan now, and ends a typed day at 23:59 in Lima', async () => {
    const { text, radio, type, submit } = await render();
    await radio('Detener ahora');
    expect(text()).toContain('El plan quedará vencido desde el lun, 26 oct., 10:00');
    await type('textarea', 'Pago revertido');
    await submit();
    expect(changePlan.mock.calls[0][0].period).toEqual({ kind: 'until', activeUntil: NOW });

    await radio('Fijar fecha de fin');
    await type('input[type="date"]', '2026-12-31');
    await submit();
    expect(changePlan.mock.calls[1][0].period).toEqual({
      kind: 'until',
      activeUntil: new Date('2027-01-01T04:59:00Z'),
    });
  });

  it('retries a lost answer with the same key, and a changed input with a new one', async () => {
    const { type, submit } = await render();
    changePlan.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', ''));
    await type('textarea', 'Yape');
    await submit();
    await submit();
    expect(changePlan.mock.calls[1][1]).toBe(changePlan.mock.calls[0][1]);

    changePlan.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', ''));
    await type('textarea', 'Plin');
    await submit();
    expect(changePlan.mock.calls[2][1]).not.toBe(changePlan.mock.calls[1][1]);
  });

  it('shows pibble refusing the change and renews the key', async () => {
    const { text, type, submit } = await render();
    changePlan.mockRejectedValueOnce(new ApiError(404, 'ORGANIZATION_NOT_FOUND', ''));
    await type('textarea', 'Yape');
    await submit();
    expect(text()).toContain('No encontramos esta organización.');
    await submit();
    expect(changePlan.mock.calls[1][1]).not.toBe(changePlan.mock.calls[0][1]);
  });
});

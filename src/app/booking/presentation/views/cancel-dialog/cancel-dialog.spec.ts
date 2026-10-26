import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { appointment } from '../../../../../testing/booking-fixtures';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CalendarStore } from '../../../application/calendar.store';
import { CancelDialog } from './cancel-dialog';

describe('CancelDialog', () => {
  let cancel: ReturnType<typeof vi.fn>;
  let dismiss: ReturnType<typeof vi.fn>;

  async function render() {
    cancel = vi.fn();
    dismiss = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        { provide: CalendarStore, useValue: { cancel } },
        { provide: MatDialogRef, useValue: { close: dismiss } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            appointment: appointment('confirmed'),
            customerName: 'Rosa Huamán',
            serviceName: 'Corte clásico',
            memberName: 'Luis',
            timeZone: 'America/Lima',
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(CancelDialog);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  const type = (host: HTMLElement, text: string) => {
    const reason = host.querySelector('textarea')!;
    reason.value = text;
    reason.dispatchEvent(new Event('input'));
  };
  const submit = async (fixture: { detectChanges(): void }, host: HTMLElement) => {
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    fixture.detectChanges();
  };

  it('B12: asks for a reason before cancelling', async () => {
    const { fixture, host } = await render();
    await submit(fixture, host);

    expect(cancel).not.toHaveBeenCalled();
    expect(host.querySelector('mat-error')?.textContent).toContain('Escribe el motivo');
  });

  it('B12: records a cancellation the customer asked for, and tells who gets a message', async () => {
    const { fixture, host } = await render();
    expect(host.textContent).toContain('el cliente recibirá un mensaje con este motivo');
    host.querySelectorAll<HTMLButtonElement>('mat-button-toggle button')[1].click();
    type(host, 'Se enfermó');
    fixture.detectChanges();
    expect(host.textContent).toContain('No le enviaremos un mensaje');

    cancel.mockResolvedValue(appointment('cancelled'));
    await submit(fixture, host);
    expect(cancel.mock.calls[0][1]).toEqual({ cancelledBy: 'customer', reason: 'Se enfermó' });
    expect(dismiss).toHaveBeenCalled();
  });

  it('retries with the same key, and a changed reason gets a new one', async () => {
    const { fixture, host } = await render();
    type(host, 'Se enfermó');
    cancel.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'offline'));

    await submit(fixture, host);
    await submit(fixture, host);
    expect(cancel.mock.calls[1][2]).toBe(cancel.mock.calls[0][2]);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Sin conexión');

    type(host, 'Se enfermó, avisó por teléfono');
    await submit(fixture, host);
    expect(cancel.mock.calls[2][2]).not.toBe(cancel.mock.calls[0][2]);
    expect(dismiss).not.toHaveBeenCalled();
  });
});

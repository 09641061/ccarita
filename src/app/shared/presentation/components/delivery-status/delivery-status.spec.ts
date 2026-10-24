import { TestBed } from '@angular/core/testing';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { DeliveryStatus, DeliveryStatusKind } from './delivery-status';

describe('DeliveryStatus', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideSpanish()] }));

  async function render(status: DeliveryStatusKind) {
    const fixture = TestBed.createComponent(DeliveryStatus);
    fixture.componentRef.setInput('status', status);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it.each([
    ['pending', 'schedule', 'Pendiente'],
    ['sent', 'check', 'Enviado'],
    ['delivered', 'done_all', 'Entregado'],
    ['read', 'done_all', 'Leído'],
    ['failed', 'error', 'No se envió'],
  ] as const)('labels %s for screen readers', async (status, icon, label) => {
    const icons = (await render(status)).querySelector('mat-icon');

    expect(icons?.textContent?.trim()).toBe(icon);
    expect(icons?.getAttribute('aria-label')).toBe(label);
  });

  it('shows nothing for an inbound message', async () => {
    expect((await render('received')).querySelector('mat-icon')).toBeNull();
  });
});

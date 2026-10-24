import { TestBed } from '@angular/core/testing';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { ROSA } from '../../../../../testing/customer-fixtures';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CustomerDetailStore } from '../../../application/customer-detail.store';
import { DeleteCustomerSheet } from './delete-customer-sheet';

describe('DeleteCustomerSheet', () => {
  let remove: ReturnType<typeof vi.fn>;
  let dismiss: ReturnType<typeof vi.fn>;

  async function render() {
    remove = vi.fn();
    dismiss = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        { provide: CustomerDetailStore, useValue: { delete: remove } },
        { provide: MatBottomSheetRef, useValue: { dismiss } },
        { provide: MAT_BOTTOM_SHEET_DATA, useValue: ROSA },
      ],
    });
    const fixture = TestBed.createComponent(DeleteCustomerSheet);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  const confirm = (host: HTMLElement) =>
    host.querySelector<HTMLButtonElement>('app-busy-button button')!.click();

  it('C5: says what stays, and deletes', async () => {
    const { host } = await render();
    expect(host.textContent).toContain('¿Eliminar a Rosa Huamán?');
    expect(host.textContent).toContain('Sus citas y conversaciones pasadas se mantienen');
    expect(host.textContent).toContain('puedes registrarlo de nuevo');
    confirm(host);
    await settle();
    expect(remove).toHaveBeenCalledWith('c-1');
    expect(dismiss).toHaveBeenCalledWith(true);
  });

  it('stays open with the reason when pibble refuses', async () => {
    const { fixture, host } = await render();
    remove.mockRejectedValue(new ApiError(403, 'ACCESS_DENIED', 'x'));
    confirm(host);
    await settle();
    fixture.detectChanges();
    expect(dismiss).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain('No tienes permiso');
  });
});

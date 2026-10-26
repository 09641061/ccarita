import { TestBed } from '@angular/core/testing';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { OpenEstablishmentSheet } from './open-establishment-sheet';

describe('OpenEstablishmentSheet', () => {
  let open: ReturnType<typeof vi.fn>;
  let dismiss: ReturnType<typeof vi.fn>;

  async function render() {
    open = vi.fn();
    dismiss = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        { provide: CurrentEstablishment, useValue: { open } },
        { provide: MatBottomSheetRef, useValue: { dismiss } },
      ],
    });
    const fixture = TestBed.createComponent(OpenEstablishmentSheet);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const type = (value: string) => {
      const name = host.querySelector<HTMLInputElement>('input')!;
      name.value = value;
      name.dispatchEvent(new Event('input'));
    };
    const submit = async () => {
      host.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle();
      await fixture.whenStable();
    };
    return { host, type, submit };
  }

  it('needs a name', async () => {
    const { submit } = await render();
    await submit();
    expect(open).not.toHaveBeenCalled();
  });

  it('retries a lost answer with the same key, and a changed form with a new one', async () => {
    const { type, submit } = await render();
    open.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', ''));
    type('Barranco');
    await submit();
    await submit();
    expect(open.mock.calls[1][1]).toBe(open.mock.calls[0][1]);
    expect(open.mock.calls[0][0]).toEqual({
      name: 'Barranco',
      address: '',
      timeZone: 'America/Lima',
    });
    expect(dismiss).toHaveBeenCalledWith(true);

    open.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', ''));
    type('Surco');
    await submit();
    type('San Isidro');
    await submit();
    expect(open.mock.calls[3][1]).not.toBe(open.mock.calls[2][1]);
  });

  it('O4: explains the plan limit', async () => {
    const { host, type, submit } = await render();
    open.mockRejectedValue(new ApiError(422, 'PLAN_LIMIT_REACHED', ''));
    type('Barranco');
    await submit();
    expect(host.textContent).toContain('Tu plan Standard permite un local activo');
    expect(dismiss).not.toHaveBeenCalled();
  });
});

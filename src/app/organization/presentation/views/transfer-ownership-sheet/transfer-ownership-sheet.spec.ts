import { TestBed } from '@angular/core/testing';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { TeamStore } from '../../../application/team.store';
import { Member } from '../../../domain/model/member';
import { TransferOwnershipSheet } from './transfer-ownership-sheet';

const KEVIN = new Member('m-2', 'kevin@gmail.com', 'Kevin', 'manager', true, 'active', []);
const ANDREA = new Member('m-3', 'andrea@hotmail.com', 'Andrea', 'staff', true, 'active', [
  'est-1',
]);

describe('TransferOwnershipSheet', () => {
  let transferOwnership: ReturnType<typeof vi.fn>;
  let dismiss: ReturnType<typeof vi.fn>;

  async function render(candidates: Member[] = [KEVIN, ANDREA]) {
    transferOwnership = vi.fn(async (id: string) => (id === KEVIN.id ? KEVIN : ANDREA));
    dismiss = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        { provide: TeamStore, useValue: { transferOwnership } },
        { provide: MatBottomSheetRef, useValue: { dismiss } },
        { provide: MAT_BOTTOM_SHEET_DATA, useValue: candidates },
      ],
    });
    const fixture = TestBed.createComponent(TransferOwnershipSheet);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const button = async (label: string) => {
      [...host.querySelectorAll<HTMLButtonElement>('button')]
        .find((b) => b.textContent!.includes(label))!
        .click();
      await settle();
      await fixture.whenStable();
    };
    const pick = async (n: number) => {
      host.querySelectorAll<HTMLInputElement>('mat-radio-button input')[n].click();
      await fixture.whenStable();
    };
    return { host, button, pick };
  }

  it('O12: asks to choose, then warns that the owner becomes a manager', async () => {
    const { host, button, pick } = await render();
    const next = () =>
      [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        b.textContent!.includes('Continuar'),
      )!;
    expect(next().disabled).toBe(true);

    await pick(0);
    await button('Continuar');
    expect(host.textContent).toContain('¿Hacer dueño a Kevin?');
    expect(host.textContent).toContain('Tú pasarás a ser Encargado');

    await button('Transferir a Kevin');
    expect(transferOwnership).toHaveBeenCalledWith('m-2', expect.any(String));
    expect(dismiss).toHaveBeenCalledWith(KEVIN);
  });

  it('retries a lost answer with the same key and another member with a new one', async () => {
    const { button, pick } = await render();
    transferOwnership.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', ''));
    await pick(0);
    await button('Continuar');
    await button('Transferir a Kevin');
    await button('Volver');
    transferOwnership.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', ''));
    await pick(1);
    await button('Continuar');
    await button('Transferir a Andrea');
    expect(transferOwnership.mock.calls[1][1]).not.toBe(transferOwnership.mock.calls[0][1]);
    await button('Transferir a Andrea');
    expect(transferOwnership.mock.calls[2][1]).toBe(transferOwnership.mock.calls[1][1]);
  });

  it('explains when nobody has joined yet', async () => {
    const { host } = await render([]);
    expect(host.textContent).toContain('Nadie más ha aceptado su invitación todavía.');
  });
});

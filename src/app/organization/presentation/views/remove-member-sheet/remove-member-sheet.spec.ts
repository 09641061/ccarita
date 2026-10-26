import { TestBed } from '@angular/core/testing';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { TeamStore } from '../../../application/team.store';
import { Member } from '../../../domain/model/member';
import { RemoveMemberSheet } from './remove-member-sheet';

const ANDREA = new Member('m-3', 'andrea@hotmail.com', 'Andrea', 'staff', true, 'active', [
  'est-1',
]);
const VALERIA = new Member('m-4', 'vale@gmail.com', 'Valeria', 'staff', true, 'pending', ['est-1']);

describe('RemoveMemberSheet', () => {
  let remove: ReturnType<typeof vi.fn>;
  let dismiss: ReturnType<typeof vi.fn>;

  async function render(member: Member) {
    remove = vi.fn();
    dismiss = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        { provide: TeamStore, useValue: { remove } },
        { provide: MatBottomSheetRef, useValue: { dismiss } },
        { provide: MAT_BOTTOM_SHEET_DATA, useValue: member },
      ],
    });
    const fixture = TestBed.createComponent(RemoveMemberSheet);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const confirm = async () => {
      host.querySelector<HTMLButtonElement>('app-busy-button button')!.click();
      await settle();
      await fixture.whenStable();
    };
    return { host, confirm };
  }

  it('removes a member, keeping their history', async () => {
    const { host, confirm } = await render(ANDREA);
    expect(host.textContent).toContain('¿Quitar a Andrea del equipo?');
    expect(host.textContent).toContain('se conservan');
    await confirm();
    expect(remove).toHaveBeenCalledWith('m-3');
    expect(dismiss).toHaveBeenCalledWith(true);
  });

  it('revokes a pending invitation', async () => {
    const { host, confirm } = await render(VALERIA);
    expect(host.textContent).toContain('¿Revocar la invitación de Valeria?');
    await confirm();
    expect(remove).toHaveBeenCalledWith('m-4');
  });

  it('O12: says what to do with upcoming appointments', async () => {
    const { host, confirm } = await render(ANDREA);
    remove.mockRejectedValue(new ApiError(422, 'MEMBER_HAS_UPCOMING_APPOINTMENTS', ''));
    await confirm();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain(
      'Andrea tiene citas pendientes. Reasígnalas o cancélalas',
    );
    expect(dismiss).not.toHaveBeenCalled();
  });
});

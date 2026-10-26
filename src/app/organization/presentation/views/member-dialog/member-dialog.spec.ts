import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { TeamStore } from '../../../application/team.store';
import { Establishment } from '../../../domain/model/establishment';
import { Member } from '../../../domain/model/member';
import { MemberDialog, MemberDialogData } from './member-dialog';

const MIRAFLORES = new Establishment('est-1', 'Miraflores', '', 'America/Lima', null);
const SURCO = new Establishment('est-2', 'Surco', '', 'America/Lima', null);
const LUIS = new Member('m-1', 'luis@donlucho.pe', 'Luis', 'owner', true, 'active', []);
const ANDREA = new Member('m-3', 'andrea@hotmail.com', 'Andrea', 'staff', true, 'active', [
  'est-2',
]);

describe('MemberDialog', () => {
  let invite: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let dismiss: ReturnType<typeof vi.fn>;

  async function render(data: Partial<MemberDialogData> = {}) {
    invite = vi.fn();
    update = vi.fn();
    dismiss = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        { provide: TeamStore, useValue: { invite, update } },
        { provide: MatDialogRef, useValue: { close: dismiss } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            member: null,
            canChangeRole: true,
            establishments: [MIRAFLORES, SURCO],
            ...data,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(MemberDialog);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const type = (index: number, value: string) => {
      const input = host.querySelectorAll<HTMLInputElement>('input[matinput]')[index];
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const click = async (selector: string) => {
      host.querySelector<HTMLElement>(selector)!.click();
      await fixture.whenStable();
    };
    const submit = async () => {
      host.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle();
      await fixture.whenStable();
    };
    return { host, type, click, submit };
  }

  const checkbox = (n: number) => `mat-checkbox:nth-of-type(${n}) input`;

  it('O10, O13: invites staff only with an establishment, and bookable by default', async () => {
    const { host, type, click, submit } = await render();
    expect(host.textContent).toContain('Le llegará un enlace por correo. Vence en 7 días.');
    type(0, 'stefano@gmail.com');
    type(1, 'Stefano');
    await submit();
    expect(host.textContent).toContain('Elige al menos un local.');
    expect(invite).not.toHaveBeenCalled();

    await click(checkbox(2));
    await submit();
    expect(invite).toHaveBeenCalledWith(
      {
        email: 'stefano@gmail.com',
        displayName: 'Stefano',
        role: 'staff',
        bookable: true,
        establishmentIds: ['est-2'],
      },
      expect.any(String),
    );
    expect(dismiss).toHaveBeenCalledWith(true);
  });

  it('checks the email before sending', async () => {
    const { host, type, submit } = await render();
    type(0, 'stefano@');
    type(1, 'Stefano');
    await submit();
    expect(host.textContent).toContain('Revisa el correo: parece incompleto.');
    expect(invite).not.toHaveBeenCalled();
  });

  it('a manager works everywhere, so no establishments are asked', async () => {
    const { host, type, click, submit } = await render();
    type(0, 'kevin@gmail.com');
    type(1, 'Kevin');
    await click('mat-radio-button:first-of-type input');
    expect(host.querySelector('fieldset')).toBeNull();
    await submit();
    expect(invite.mock.calls[0][0]).toMatchObject({ role: 'manager' });
  });

  it('retries a lost answer with the same key and a new email with a new one', async () => {
    const { type, click, submit } = await render();
    invite.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', ''));
    type(0, 'stefano@gmail.com');
    type(1, 'Stefano');
    await click(checkbox(1));
    await submit();
    await submit();
    expect(invite.mock.calls[1][1]).toBe(invite.mock.calls[0][1]);

    invite.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', ''));
    type(0, 'stefano.rojas@gmail.com');
    await submit();
    expect(invite.mock.calls[2][1]).not.toBe(invite.mock.calls[1][1]);
  });

  it('O11: says when the email is already in the team', async () => {
    const { host, type, click, submit } = await render();
    invite.mockRejectedValue(new ApiError(409, 'MEMBER_CONFLICT', ''));
    type(0, 'andrea@hotmail.com');
    type(1, 'Andrea');
    await click(checkbox(1));
    await submit();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain(
      'Ese correo ya está en tu equipo o ya tiene una invitación.',
    );
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('edits a member with a PUT and keeps their establishments', async () => {
    const { host, click, submit } = await render({ member: ANDREA });
    expect(host.querySelector('h2')!.textContent).toContain('Editar a Andrea');
    expect(host.querySelectorAll('input[matinput]')).toHaveLength(1);
    await click('mat-slide-toggle button');
    await submit();
    expect(update).toHaveBeenCalledWith('m-3', {
      displayName: 'Andrea',
      bookable: false,
      role: 'staff',
      establishmentIds: ['est-2'],
    });
  });

  it('O12: the owner’s role is locked', async () => {
    const { host, submit } = await render({ member: LUIS, canChangeRole: false });
    expect(host.querySelector('mat-radio-group')).toBeNull();
    expect(host.textContent).toContain('El dueño sigue siendo dueño.');
    await submit();
    expect(update.mock.calls[0][1]).toMatchObject({ role: 'owner', establishmentIds: [] });
  });
});

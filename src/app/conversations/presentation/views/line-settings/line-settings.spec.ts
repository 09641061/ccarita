import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import {
  CurrentEstablishment,
  CurrentOrganization,
  MemberAction,
  MemberRole,
} from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { WhatsappLineStore } from '../../../application/whatsapp-line.store';
import { WhatsappLine } from '../../../domain/model/whatsapp-line';
import { DisconnectLineDialog } from '../disconnect-line-dialog/disconnect-line-dialog';
import { LineSettings } from './line-settings';

const NEVER = new ApiError(404, 'WHATSAPP_LINE_NOT_FOUND', '');
const line = (connected: boolean) =>
  new WhatsappLine('l-1', 'est-1', '+51 900 000 000', 'coexistence', connected, {
    reminder: 'approved',
    confirmation: 'pending',
    cancellation: 'rejected',
  });

describe('LineSettings', () => {
  let store: {
    line: ReturnType<typeof fakeResource<WhatsappLine>>;
    signupAvailable: boolean;
    signUpWithMeta: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
  };
  let open: ReturnType<typeof vi.fn>;

  async function render(
    current: WhatsappLine | ApiError,
    options: { role?: MemberRole; planActive?: boolean; withMeta?: boolean } = {},
  ) {
    store = {
      line: fakeResource(current instanceof WhatsappLine ? current : undefined),
      signupAvailable: options.withMeta ?? false,
      signUpWithMeta: vi.fn(async () => ({
        code: 'meta-code',
        wabaId: 'w-9',
        phoneNumberId: 'p-9',
      })),
      connect: vi.fn(async () => line(true)),
    };
    if (current instanceof ApiError) store.line.error.set(current);
    open = vi.fn();
    const role = options.role ?? 'owner';
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        { provide: WhatsappLineStore, useValue: store },
        {
          provide: CurrentOrganization,
          useValue: {
            can: (action: MemberAction) => action !== 'connectWhatsapp' || role === 'owner',
            planActive: signal(options.planActive ?? true),
          },
        },
        {
          provide: CurrentEstablishment,
          useValue: { id: signal('est-1'), selected: signal({ name: 'Miraflores' }) },
        },
        { provide: MatDialog, useValue: { open } },
      ],
    });
    const fixture = TestBed.createComponent(LineSettings);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const stable = async () => {
      await settle();
      await fixture.whenStable();
    };
    return { host, stable };
  }

  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');
  const button = (host: HTMLElement, label: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent!.includes(label),
    );

  it('W2: explains a line never connected and that Meta is not set up in this build', async () => {
    const { host } = await render(NEVER);
    expect(text(host)).toContain('Conecta el WhatsApp de Miraflores');
    expect(text(host)).toContain('Sigues usando la app WhatsApp Business');
    expect(text(host)).toContain('aún no está configurada');
    expect(button(host, 'Conectar con WhatsApp')).toBeUndefined();
  });

  it('development builds connect with the values pibble’s dev mode accepts, retrying with the same key', async () => {
    const { host, stable } = await render(NEVER);
    expect(text(host)).toContain('Conexión de prueba (solo desarrollo)');
    store.connect.mockRejectedValueOnce(new ApiError(503, 'UNEXPECTED_ERROR', ''));
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await stable();
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await stable();

    expect(store.connect.mock.calls[0]).toEqual([
      'est-1',
      {
        code: 'dev-code',
        wabaId: '102290129340398',
        phoneNumberId: '106540352242922',
        mode: 'coexistence',
      },
      expect.any(String),
    ]);
    expect(store.connect.mock.calls[1][2]).toBe(store.connect.mock.calls[0][2]);
  });

  it('W2: with Meta set up, sends what Embedded Signup returned in coexistence mode', async () => {
    const { host, stable } = await render(NEVER, { withMeta: true });
    expect(text(host)).not.toContain('solo desarrollo');
    store.connect.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', ''));
    button(host, 'Conectar con WhatsApp')!.click();
    await stable();
    button(host, 'Conectar con WhatsApp')!.click();
    await stable();

    expect(store.signUpWithMeta).toHaveBeenCalledTimes(1);
    expect(store.connect.mock.calls[1]).toEqual([
      'est-1',
      { code: 'meta-code', wabaId: 'w-9', phoneNumberId: 'p-9', mode: 'coexistence' },
      store.connect.mock.calls[0][2],
    ]);
  });

  it('shows a refused signup next to the action', async () => {
    const { host, stable } = await render(NEVER, { withMeta: true });
    store.connect.mockRejectedValue(new ApiError(409, 'LINE_ALREADY_CONNECTED', ''));
    button(host, 'Conectar con WhatsApp')!.click();
    await stable();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain(
      'ya está conectado a otro local',
    );
  });

  it('shows the connected number, its templates and disconnecting', async () => {
    const { host } = await render(line(true));
    expect(text(host)).toContain('+51 900 000 000');
    expect(text(host)).toContain('Conectado');
    const rows = [...host.querySelectorAll('.templates li')].map((li) =>
      [...li.querySelectorAll('span')].map((s) => s.textContent!.replace(/\s+/g, ' ').trim()),
    );
    expect(rows.map(([name]) => name)).toEqual(['Recordatorio', 'Confirmación', 'Cancelación']);
    expect(rows.map(([, badge]) => badge)).toEqual([
      'check Aprobada',
      'schedule En revisión',
      'block Rechazada',
    ]);
    expect(host.querySelector('form')).toBeNull();
    button(host, 'Desconectar')!.click();
    expect(open).toHaveBeenCalledWith(
      DisconnectLineDialog,
      expect.objectContaining({ data: line(true) }),
    );
  });

  it('W1: offers connecting a disconnected line again', async () => {
    const { host } = await render(line(false), { withMeta: true });
    expect(text(host)).toContain('Desconectado');
    expect(button(host, 'Volver a conectar')).toBeDefined();
  });

  it('O6: an inactive plan disables connecting, not disconnecting', async () => {
    const off = await render(NEVER, { withMeta: true, planActive: false });
    expect(button(off.host, 'Conectar con WhatsApp')!.disabled).toBe(true);
    TestBed.resetTestingModule();
    const on = await render(line(true), { planActive: false });
    expect(button(on.host, 'Desconectar')!.disabled).toBe(false);
  });

  it('03 §5: only the owner connects the line', async () => {
    const { host } = await render(line(true), { role: 'manager' });
    expect(text(host)).toContain('Solo el dueño conecta el WhatsApp');
  });

  it('offers a retry when the line cannot be read', async () => {
    const { host } = await render(new ApiError(0, 'NETWORK_ERROR', ''));
    button(host, 'Reintentar')!.click();
    expect(store.line.reload).toHaveBeenCalled();
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { WhatsappLineStore } from '../../../../conversations/public-api';
import {
  CurrentEstablishment,
  CurrentOrganization,
  MemberAction,
  MemberRole,
} from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { AssistantSettingsStore } from '../../../application/assistant-settings.store';
import { AssistantSettings } from '../../../domain/model/assistant-settings';
import { AssistantConfiguration } from './assistant-configuration';

/** The parts of a WhatsApp line the status card reads. */
const line = (connected: boolean) => ({ displayPhone: '+51 1 445 2200', connected });

describe('AssistantConfiguration', () => {
  let store: {
    settings: ReturnType<typeof fakeResource<AssistantSettings>>;
    save: ReturnType<typeof vi.fn>;
  };

  async function render(
    current: AssistantSettings | ApiError,
    options: {
      role?: MemberRole;
      planActive?: boolean;
      line?: ReturnType<typeof line> | ApiError;
    } = {},
  ) {
    store = {
      settings: fakeResource(current instanceof AssistantSettings ? current : undefined),
      save: vi.fn(
        async (id: string, command: { enabled: boolean; businessInfo: string }) =>
          new AssistantSettings(id, command.enabled, command.businessInfo),
      ),
    };
    if (current instanceof ApiError) store.settings.error.set(current);
    const lineOption = options.line ?? line(true);
    const lineResource = fakeResource(lineOption instanceof ApiError ? undefined : lineOption);
    if (lineOption instanceof ApiError) lineResource.error.set(lineOption);
    const role = options.role ?? 'owner';
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter([]),
        { provide: AssistantSettingsStore, useValue: store },
        { provide: WhatsappLineStore, useValue: { line: lineResource } },
        {
          provide: CurrentOrganization,
          useValue: {
            can: (action: MemberAction) =>
              role === 'owner' || (role === 'manager' && action === 'editSettings'),
            planActive: signal(options.planActive ?? true),
          },
        },
        { provide: CurrentEstablishment, useValue: { id: signal('est-1') } },
      ],
    });
    const fixture = TestBed.createComponent(AssistantConfiguration);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const stable = async () => {
      await settle();
      await fixture.whenStable();
    };
    return { host, stable };
  }

  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');
  const toggle = (host: HTMLElement) =>
    host.querySelector<HTMLButtonElement>('mat-slide-toggle button[role="switch"]')!;
  const textarea = (host: HTMLElement) => host.querySelector('textarea')!;
  const type = (host: HTMLElement, value: string) => {
    textarea(host).value = value;
    textarea(host).dispatchEvent(new Event('input'));
  };
  const submit = (host: HTMLElement) =>
    host.querySelector('form')!.dispatchEvent(new Event('submit'));

  it('A2: says it answers on the connected line', async () => {
    const { host } = await render(new AssistantSettings('est-1', true, ''));
    expect(text(host)).toContain('Respondiendo en WhatsApp');
    expect(text(host)).toContain('+51 1 445 2200 ·');
    expect(toggle(host).getAttribute('aria-checked')).toBe('true');
    expect(toggle(host).getAttribute('aria-label')).toBe('El asistente responde en WhatsApp');
  });

  it('A2: says when it cannot answer without a line, and links the owner to it', async () => {
    const { host } = await render(new AssistantSettings('est-1', true, ''), {
      line: line(false),
    });
    expect(text(host)).toContain('Encendido, pero sin WhatsApp');
    expect(host.querySelector('a[href="/ajustes/whatsapp"]')).not.toBeNull();
  });

  it('A2: a line never connected is no line; managers get no link to it', async () => {
    const { host } = await render(new AssistantSettings('est-1', true, ''), {
      role: 'manager',
      line: new ApiError(404, 'WHATSAPP_LINE_NOT_FOUND', ''),
    });
    expect(text(host)).toContain('Encendido, pero sin WhatsApp');
    expect(host.querySelector('a[href="/ajustes/whatsapp"]')).toBeNull();
  });

  it('A1: is off with no business info until configured', async () => {
    const { host } = await render(new AssistantSettings('est-1', false, ''));
    expect(text(host)).toContain('Asistente apagado');
    expect(text(host)).toContain('0 / 4000 caracteres');
    expect(toggle(host).getAttribute('aria-checked')).toBe('false');
  });

  it('A1: the switch saves the new state with the saved business info, not the draft', async () => {
    const { host, stable } = await render(new AssistantSettings('est-1', false, 'Yape'));
    type(host, 'Borrador sin guardar');
    toggle(host).click();
    await stable();
    expect(store.save).toHaveBeenCalledWith('est-1', { enabled: true, businessInfo: 'Yape' });
  });

  it('turns the switch back and says why when saving it fails', async () => {
    const { host, stable } = await render(new AssistantSettings('est-1', false, ''));
    store.save.mockRejectedValueOnce(new ApiError(422, 'ESTABLISHMENT_ARCHIVED', ''));
    toggle(host).click();
    await stable();
    expect(toggle(host).getAttribute('aria-checked')).toBe('false');
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('A1: saves the typed business info with the current state and counts it', async () => {
    const { host, stable } = await render(new AssistantSettings('est-1', true, ''));
    type(host, 'Aceptamos Yape y Plin.');
    await stable();
    expect(text(host)).toContain('22 / 4000 caracteres');
    expect(textarea(host).getAttribute('maxlength')).toBe('4000');
    submit(host);
    await stable();
    expect(store.save).toHaveBeenCalledWith('est-1', {
      enabled: true,
      businessInfo: 'Aceptamos Yape y Plin.',
    });
    expect(text(host)).toContain('Cambios guardados.');
  });

  it('keeps the typed text after a conflict and asks to save again', async () => {
    const { host, stable } = await render(new AssistantSettings('est-1', false, ''));
    store.save.mockRejectedValueOnce(new ApiError(409, 'ASSISTANT_SETTINGS_CONFLICT', ''));
    type(host, 'Mi texto');
    submit(host);
    await stable();
    store.settings.set(new AssistantSettings('est-1', true, 'Del otro'));
    await stable();
    expect(textarea(host).value).toBe('Mi texto');
    expect(text(host)).toContain('Alguien más guardó los ajustes del asistente');
    expect(text(host)).toContain('tu texto sigue aquí');
  });

  it('O6: an inactive plan disables the switch and saving', async () => {
    const { host } = await render(new AssistantSettings('est-1', true, 'Yape'), {
      planActive: false,
    });
    expect(text(host)).toContain('Encendido, pero en pausa');
    expect(toggle(host).disabled).toBe(true);
    expect(textarea(host).readOnly).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });

  it('lists what it can and never does (A5, A6)', async () => {
    const { host } = await render(new AssistantSettings('est-1', true, ''));
    expect(text(host)).toContain('Buscar horarios libres y reservar');
    expect(text(host)).toContain('Dar descuentos ni cambiar precios');
  });

  it('03 §5: staff see no permission', async () => {
    const { host } = await render(new AssistantSettings('est-1', true, ''), { role: 'staff' });
    expect(text(host)).toContain('no está disponible');
  });

  it('shows offline and error states with retry', async () => {
    const { host } = await render(new ApiError(0, 'NETWORK_ERROR', ''));
    expect(text(host)).toContain('No hay conexión');
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent!.includes('Reintentar'))!
      .click();
    expect(store.settings.reload).toHaveBeenCalled();
  });

  it('shows pibble’s refusal as no permission', async () => {
    const { host } = await render(new ApiError(403, 'ACCESS_DENIED', ''));
    expect(text(host)).toContain('no está disponible');
  });

  it('shows a skeleton while loading', async () => {
    const { host } = await render(new ApiError(0, 'X', ''));
    store.settings.error.set(undefined);
    TestBed.tick();
    expect(host.querySelector('app-skeleton')).not.toBeNull();
  });
});

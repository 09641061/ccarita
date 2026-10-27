import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appointment } from '../../../../../testing/booking-fixtures';
import { conversation, message } from '../../../../../testing/conversation-fixtures';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { Appointment, UpcomingAppointments } from '../../../../booking/public-api';
import {
  CurrentEstablishment,
  CurrentOrganization,
  EstablishmentTeam,
  Member,
  Service,
} from '../../../../organization/public-api';
import { Money } from '../../../../shared/domain/model/money';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { ConversationStore } from '../../../application/conversation.store';
import { InboxStore } from '../../../application/inbox.store';
import { Conversation } from '../../../domain/model/conversation';
import { Message } from '../../../domain/model/message';
import { WhatsappLine } from '../../../domain/model/whatsapp-line';
import { Chat } from './chat';

const NOW = new Date('2026-10-24T15:00:00Z');
const KEVIN = new Member('m-2', 'kevin@example.com', 'Kevin', 'staff', true, 'active', ['est-1']);
const LUIS = new Member('m-1', 'luis@example.com', 'Luis', 'owner', true, 'active', []);
const ANDREA = new Member('m-3', 'andrea@example.com', 'Andrea', 'staff', true, 'active', [
  'est-2',
]);
const CUT = new Service('s-1', 'est-1', 'Corte + barba', 60, new Money(4500, 'PEN'), true, ['m-2']);
const LINE = new WhatsappLine('l-1', 'est-1', '+51 900 000 000', 'coexistence', true, {
  reminder: 'approved',
  confirmation: 'pending',
});
const CLOSED = { lastInboundAt: new Date('2026-10-22T23:04:00Z') };
const MONDAY = appointment('confirmed', {
  id: 'a-1',
  customerId: 'cu-1',
  staffMemberId: 'm-2',
  start: '2026-10-26T15:00:00Z',
  end: '2026-10-26T16:00:00Z',
});
const LATER = appointment('confirmed', {
  id: 'a-2',
  customerId: 'cu-1',
  staffMemberId: 'm-2',
  start: '2026-11-02T15:00:00Z',
  end: '2026-11-02T16:00:00Z',
});

describe('Chat', () => {
  let store: ReturnType<typeof fakeStore>;
  let line: ReturnType<typeof fakeResource<WhatsappLine>>;
  let upcoming: {
    appointments: ReturnType<typeof fakeResource<readonly Appointment[]>>;
    select: ReturnType<typeof vi.fn>;
    reload: ReturnType<typeof vi.fn>;
  };
  const planActive = signal(true);

  function fakeStore(c: Conversation, messages: Message[]) {
    return {
      openedId: signal<string | null>('c-1'),
      conversation: fakeResource<Conversation>(c),
      latest: fakeResource({ items: messages, nextCursor: null }),
      messages: signal<readonly Message[] | null>(messages),
      hasOlder: signal(false),
      loadingOlder: signal(false),
      open: vi.fn(),
      loadOlder: vi.fn(),
      send: vi.fn(),
      sendTemplate: vi.fn(),
      assign: vi.fn<(memberId: string | null) => Promise<void>>().mockResolvedValue(undefined),
      pauseAssistant: vi.fn<(key: string) => Promise<void>>().mockResolvedValue(undefined),
      resumeAssistant: vi.fn<(key: string) => Promise<void>>().mockResolvedValue(undefined),
      media: vi.fn(() => new Promise<Blob>(() => undefined)),
    };
  }

  async function render(
    c: Conversation = conversation(),
    messages: Message[] = [],
    appointments: readonly Appointment[] = [MONDAY],
  ) {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    store = fakeStore(c, messages);
    line = fakeResource<WhatsappLine>(LINE);
    upcoming = {
      appointments: fakeResource<readonly Appointment[]>(appointments),
      select: vi.fn(),
      reload: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter(
          [
            { path: 'mensajes/:conversationId', component: Chat },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        { provide: ConversationStore, useValue: store },
        { provide: InboxStore, useValue: { line } },
        { provide: CurrentOrganization, useValue: { planActive } },
        { provide: CurrentEstablishment, useValue: { timeZone: signal('America/Lima') } },
        {
          provide: EstablishmentTeam,
          useValue: {
            members: { value: signal([LUIS, KEVIN, ANDREA]) },
            membersById: signal(new Map([LUIS, KEVIN, ANDREA].map((m) => [m.id, m]))),
            servicesById: signal(new Map([[CUT.id, CUT]])),
          },
        },
        { provide: UpcomingAppointments, useValue: upcoming },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/mensajes/c-1');
    await harness.fixture.whenStable();
    const host = harness.routeNativeElement as HTMLElement;
    return { host, stable: () => harness.fixture.whenStable() };
  }

  beforeEach(() => planActive.set(true));
  afterEach(() => vi.useRealTimers());

  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');
  const textarea = (host: HTMLElement) => host.querySelector('textarea');
  const type = (host: HTMLElement, value: string) => {
    textarea(host)!.value = value;
    textarea(host)!.dispatchEvent(new Event('input'));
  };
  const button = (host: HTMLElement, label: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent!.includes(label) || b.getAttribute('aria-label')?.startsWith(label),
    );
  const press = async (target: HTMLElement | undefined, stable: () => Promise<void>) => {
    target!.click();
    await settle();
    await stable();
  };
  const submit = async (host: HTMLElement, stable: () => Promise<void>) => {
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    await stable();
  };

  it('opens the conversation and shows its messages by day, signed by who wrote them', async () => {
    const { host } = await render(
      conversation({ assistantHandedOff: true, handoffSummary: 'Pidió hablar con alguien' }),
      [
        message({ id: 'm-1', occurredAt: new Date('2026-10-23T22:00:00Z'), body: 'Hola' }),
        message({
          id: 'm-2',
          direction: 'out',
          origin: 'assistant',
          status: 'read',
          body: 'Tengo estos horarios',
          choices: { style: 'buttons', titles: ['15:00', '15:45'] },
          occurredAt: new Date('2026-10-24T14:00:00Z'),
        }),
        message({
          id: 'm-3',
          direction: 'out',
          origin: 'staff',
          sentByMemberId: 'm-2',
          status: 'failed',
          body: 'Te espero',
          occurredAt: new Date('2026-10-24T14:30:00Z'),
        }),
      ],
    );
    expect(store.open).toHaveBeenCalledWith('c-1');
    expect(host.querySelector('h2')!.textContent).toContain('Rosa Huamán');
    expect(text(host)).toContain('+51987654321');
    expect(text(host)).toContain('Traspasada a una persona · Pidió hablar con alguien');
    const days = [...host.querySelectorAll('h3.day')].map((d) => d.textContent!.trim());
    expect(days).toEqual(['Ayer', 'Hoy']);
    expect(text(host)).toContain('Tako');
    expect(text(host)).toContain('15:45');
    expect(text(host)).toContain('Kevin');
    expect(text(host)).toContain('No se entregó');
    expect(host.querySelector('[aria-label="Leído"]')).not.toBeNull();
    expect(host.querySelector('a[href="/clientes/cu-1"]')).not.toBeNull();
    expect(host.querySelector('a[href="/agenda/reservar?cliente=cu-1"]')).not.toBeNull();
  });

  it('lets a message that arrives while the chat is open enter with motion, and marks the answering assistant', async () => {
    const { host, stable } = await render(conversation(), [
      message({ id: 'm-1', occurredAt: new Date('2026-10-24T14:00:00Z') }),
    ]);
    expect(host.querySelector('app-message-bubble.fresh')).toBeNull();
    expect(host.querySelector('h2 .tako-live img')?.getAttribute('alt')).toBe(
      'Tako está atendiendo este chat',
    );

    store.messages.set([
      message({ id: 'm-1', occurredAt: new Date('2026-10-24T14:00:00Z') }),
      message({
        id: 'm-2',
        direction: 'out',
        origin: 'assistant',
        body: 'Claro',
        occurredAt: new Date('2026-10-24T14:00:08Z'),
      }),
    ]);
    await stable();

    const fresh = [...host.querySelectorAll('app-message-bubble.fresh')];
    expect(fresh).toHaveLength(1);
    expect(fresh[0].classList).toContain('assistant');
  });

  it('retries a lost reply with the same key, and sends the next one with a new key', async () => {
    const { host, stable } = await render();
    type(host, 'Sí, a las 4');
    store.send.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'));
    await submit(host, stable);
    expect(text(host)).toContain('Reintentar');
    store.send.mockResolvedValueOnce(message({ id: 'm-9' }));
    await submit(host, stable);
    const [[firstBody, first], [, retry]] = store.send.mock.calls;
    expect(firstBody).toBe('Sí, a las 4');
    expect(retry).toBe(first);
    expect(textarea(host)!.value).toBe('');

    type(host, 'Te esperamos');
    store.send.mockResolvedValueOnce(message({ id: 'm-10' }));
    await submit(host, stable);
    expect(store.send.mock.calls[2][1]).not.toBe(first);
  });

  it('sends a changed text after a lost answer with a new key', async () => {
    const { host, stable } = await render();
    type(host, 'Sí');
    store.send.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'));
    await submit(host, stable);
    type(host, 'Sí, a las 4');
    store.send.mockResolvedValueOnce(message());
    await submit(host, stable);
    expect(store.send.mock.calls[1][1]).not.toBe(store.send.mock.calls[0][1]);
  });

  it('W6: explains a closed window and offers no free text', async () => {
    const { host } = await render(
      conversation({ lastInboundAt: new Date('2026-10-22T23:04:00Z') }),
    );
    expect(textarea(host)).toBeNull();
    expect(text(host)).toContain('Solo puedes enviar un mensaje aprobado');
    expect(text(host)).toContain('La ventana de 24 h se cerró el');
    expect(text(host)).toContain('Ventana de 24 h cerrada');
  });

  it('shows pibble’s message when the window closed meanwhile, and reloads the conversation', async () => {
    const { host, stable } = await render();
    type(host, 'Hola');
    store.send.mockRejectedValueOnce(new ApiError(422, 'WINDOW_CLOSED', 'x'));
    await submit(host, stable);
    expect(host.querySelector('[role="alert"]')!.textContent).toContain(
      'Solo puedes enviar una plantilla',
    );
    expect(store.conversation.reload).toHaveBeenCalled();
    expect(text(host)).not.toContain('Reintentar');
  });

  it('O6: keeps reading and closes replying while the plan is inactive', async () => {
    planActive.set(false);
    const { host } = await render(conversation(), [message()]);
    expect(textarea(host)).toBeNull();
    expect(text(host)).toContain('Responder vuelve cuando renueves el plan');
    expect(
      host.querySelector('a[href="/agenda/reservar?cliente=cu-1"]')!.getAttribute('aria-disabled'),
    ).toBe('true');
    expect(text(host)).toContain('Hola, ¿tienen cita mañana?');
  });

  it('closes replying while the line is disconnected', async () => {
    const { host, stable } = await render();
    line.set(new WhatsappLine('l-1', 'est-1', '+51 900 000 000', 'coexistence', false, {}));
    await stable();
    expect(textarea(host)).toBeNull();
    expect(text(host)).toContain('La línea de WhatsApp está desconectada');
  });

  it('C5: names a deleted customer and links to no profile', async () => {
    const { host } = await render(
      conversation({ customerDeleted: true, customerName: null, customerPhone: null }),
    );
    expect(host.querySelector('h2')!.textContent).toContain('Cliente eliminado');
    expect(host.querySelector('a[href^="/clientes"]')).toBeNull();
    expect(text(host)).toContain('Ya no puedes escribirle');
  });

  it('shows a conversation that does not exist', async () => {
    const { host, stable } = await render();
    store.conversation.error.set(new ApiError(404, 'CONVERSATION_NOT_FOUND', 'x'));
    await stable();
    expect(text(host)).toContain('No encontramos esta conversación');
  });

  it('loads older messages on request', async () => {
    const { host, stable } = await render(conversation(), [message()]);
    store.hasOlder.set(true);
    await stable();
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent!.includes('Ver mensajes anteriores'))!
      .click();
    expect(store.loadOlder).toHaveBeenCalled();
  });

  it('W6, W11: outside the window sends an approved reminder of the next appointment', async () => {
    const { host, stable } = await render(conversation(CLOSED));
    expect(upcoming.select).toHaveBeenLastCalledWith('cu-1');
    expect(text(host)).toContain('Recordatorio de su cita');
    expect(text(host)).toContain('Aprobada');
    expect(text(host)).toMatch(/lun\.? 26 oct\.? · 10:00 – 11:00 · Corte \+ barba con Kevin/);
    expect(text(host)).toContain('En revisión');
    expect(text(host)).toContain('Meta aún no la aprueba');
    const radios = host.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(radios[1].disabled).toBe(true);

    store.sendTemplate.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'));
    await press(button(host, 'Enviar recordatorio'), stable);
    expect(text(host)).toContain('Reintentar');
    store.sendTemplate.mockResolvedValueOnce(message({ id: 'm-9', kind: 'template' }));
    await press(button(host, 'Reintentar'), stable);
    const [[command, first], [, retry]] = store.sendTemplate.mock.calls;
    expect(command).toEqual({ template: 'reminder', appointmentId: 'a-1' });
    expect(retry).toBe(first);
  });

  it('sends another appointment’s reminder after a lost answer with a new key', async () => {
    const { host, stable } = await render(conversation(CLOSED), [], [MONDAY, LATER]);
    store.sendTemplate.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'));
    await press(button(host, 'Enviar recordatorio'), stable);
    host.querySelector<HTMLElement>('mat-select')!.click();
    await stable();
    await press(
      [...document.querySelectorAll<HTMLElement>('mat-option')].find((o) =>
        o.textContent!.includes('2 nov'),
      ),
      stable,
    );
    store.sendTemplate.mockResolvedValueOnce(message({ id: 'm-9', kind: 'template' }));
    await press(button(host, 'Enviar recordatorio'), stable);
    const [[, first], [command, second]] = store.sendTemplate.mock.calls;
    expect(command).toEqual({ template: 'reminder', appointmentId: 'a-2' });
    expect(second).not.toBe(first);
  });

  it('says when the customer has no upcoming appointment and links to booking', async () => {
    const { host } = await render(conversation(CLOSED), [], []);
    expect(text(host)).toContain('No tiene citas próximas');
    expect(
      host.querySelector('app-template-picker a[href="/agenda/reservar?cliente=cu-1"]'),
    ).not.toBeNull();
    expect(button(host, 'Enviar recordatorio')).toBeUndefined();
  });

  it('W6: inside the window opens the templates on request, a confirmation as normal text', async () => {
    const { host, stable } = await render();
    expect(upcoming.select).toHaveBeenLastCalledWith(null);
    await press(button(host, 'Recordatorio o confirmación'), stable);
    expect(upcoming.select).toHaveBeenLastCalledWith('cu-1');
    expect(text(host)).toContain('Como mensaje normal');
    const radios = host.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(radios[1].disabled).toBe(false);
  });

  it('O6: an inactive plan offers no templates but still assigns and pauses', async () => {
    planActive.set(false);
    const { host, stable } = await render(conversation(CLOSED));
    expect(button(host, 'Enviar recordatorio')).toBeUndefined();
    expect(button(host, 'Pausar asistente')!.disabled).toBe(false);
    await press(button(host, 'Pausar asistente'), stable);
    expect(store.pauseAssistant).toHaveBeenCalled();
    expect(button(host, 'Asignar conversación')!.disabled).toBe(false);
  });

  it('W9: assigns to a member of the establishment or to nobody', async () => {
    const { host, stable } = await render(conversation({ assignedMemberId: 'm-1' }));
    await press(button(host, 'Asignar conversación: Luis'), stable);
    const items = [...document.querySelectorAll<HTMLElement>('[mat-menu-item]')].map((i) =>
      i.textContent!.replace(/\s+/g, ''),
    );
    expect(items).toEqual(['person_offSinasignar', 'checkLuis', 'personKevin']);
    expect(items.some((i) => i.includes('Andrea'))).toBe(false);
    await press(
      [...document.querySelectorAll<HTMLElement>('[mat-menu-item]')].find((i) =>
        i.textContent!.includes('Kevin'),
      ),
      stable,
    );
    expect(store.assign).toHaveBeenCalledWith('m-2');
  });

  it('A3: pauses with a key, and retries a lost answer with the same key', async () => {
    const { host, stable } = await render();
    store.pauseAssistant.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'));
    await press(button(host, 'Pausar asistente'), stable);
    await press(button(host, 'Reintentar'), stable);
    const [[first], [retry]] = store.pauseAssistant.mock.calls;
    expect(retry).toBe(first);
  });

  it('A3: offers resuming a paused assistant and names who paused it', async () => {
    const { host, stable } = await render(
      conversation({ assistantPausedManually: true, assistantPausedByMemberId: 'm-1' }),
    );
    expect(text(host)).toContain('Asistente pausado por Luis');
    expect(text(host)).toContain('el asistente responde desde el próximo mensaje');
    await press(button(host, 'Retomar asistente'), stable);
    expect(store.resumeAssistant).toHaveBeenCalled();
  });

  it('A7: resumes the assistant from the handoff banner', async () => {
    const { host, stable } = await render(
      conversation({ assistantHandedOff: true, handoffSummary: 'Pidió hablar con alguien' }),
    );
    const resume = host.querySelector<HTMLButtonElement>('.handoff button');
    expect(resume!.textContent).toContain('Retomar asistente');
    await press(resume!, stable);
    expect(store.resumeAssistant).toHaveBeenCalled();
  });
});

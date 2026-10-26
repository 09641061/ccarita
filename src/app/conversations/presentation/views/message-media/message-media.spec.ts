import { TestBed } from '@angular/core/testing';
import { message } from '../../../../../testing/conversation-fixtures';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { ConversationStore } from '../../../application/conversation.store';
import { Message } from '../../../domain/model/message';
import { MessageMedia } from './message-media';

describe('MessageMedia', () => {
  let media: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = vi.fn();
  });

  function render() {
    media = vi.fn();
    TestBed.configureTestingModule({
      providers: [provideSpanish(), { provide: ConversationStore, useValue: { media } }],
    });
    return media;
  }

  async function mount(m: Message) {
    const fixture = TestBed.createComponent(MessageMedia);
    fixture.componentRef.setInput('message', m);
    await fixture.whenStable();
    await settle();
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  const photo = (overrides: Partial<Message> = {}) =>
    message({ id: 'm-1', kind: 'image', hasMedia: true, mediaStatus: 'ready', ...overrides });

  it('shows a ready photo through an object URL and revokes it when it leaves', async () => {
    render().mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }));
    const { fixture, host } = await mount(photo());
    expect(media).toHaveBeenCalledWith('m-1');
    const img = host.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('blob:photo');
    expect(img.alt).toBe('Foto que envió el cliente');
    fixture.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
  });

  it('C5: shows removed media without asking pibble', async () => {
    render();
    const { host } = await mount(photo({ mediaStatus: 'removed' }));
    expect(media).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Archivo eliminado');
  });

  it('shows media still downloading and media that failed', async () => {
    render();
    const pending = await mount(photo({ mediaStatus: 'pending' }));
    expect(pending.host.textContent).toContain('Descargando archivo de WhatsApp');
    const failed = await mount(photo({ mediaStatus: 'failed' }));
    expect(failed.host.textContent).toContain('No se pudo descargar el archivo');
  });

  it('turns pibble’s media codes into states', async () => {
    render().mockRejectedValue(new ApiError(409, 'MEDIA_NOT_READY', 'x'));
    const { host } = await mount(photo());
    expect(host.textContent).toContain('Descargando archivo de WhatsApp');
    media.mockRejectedValue(new ApiError(404, 'MEDIA_REMOVED', 'x'));
    host.querySelector('button')!.click();
    await settle();
    expect(media).toHaveBeenCalledTimes(2);
  });

  it('downloads a document only when asked', async () => {
    render();
    const { host } = await mount(photo({ kind: 'document' }));
    expect(media).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Descargar documento');
  });
});

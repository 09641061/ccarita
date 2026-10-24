import { TestBed } from '@angular/core/testing';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { MessageOrigin, MessageOriginKind } from './message-origin';

describe('MessageOrigin', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideSpanish()] }));

  async function render(origin: MessageOriginKind, memberName?: string) {
    const fixture = TestBed.createComponent(MessageOrigin);
    fixture.componentRef.setInput('origin', origin);
    if (memberName) fixture.componentRef.setInput('memberName', memberName);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('signs assistant messages with the mark as Tako', async () => {
    const origin = await render('assistant');

    expect(origin.querySelector('app-brand-mark')).not.toBeNull();
    expect(origin.querySelector('mat-icon')).toBeNull();
    expect(origin.textContent).toContain('Tako');
  });

  it('names the team member who wrote', async () => {
    const origin = await render('staff', 'Kevin');

    expect(origin.querySelector('mat-icon')?.textContent).toBe('account_circle');
    expect(origin.textContent).toContain('Kevin');
  });

  it('marks messages from the WhatsApp Business app and imported history', async () => {
    expect((await render('business_app')).textContent).toContain('Desde WhatsApp Business');
    expect((await render('history')).textContent).toContain('Historial importado');
  });
});

import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { WhatsappLineStore } from '../../../application/whatsapp-line.store';
import { WhatsappLine } from '../../../domain/model/whatsapp-line';
import { DisconnectLineDialog } from './disconnect-line-dialog';

describe('DisconnectLineDialog', () => {
  it('W1: says the conversations stay and disconnects the line', async () => {
    const disconnect = vi.fn(async () => undefined);
    const dismiss = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        { provide: WhatsappLineStore, useValue: { disconnect } },
        { provide: MatDialogRef, useValue: { close: dismiss } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: new WhatsappLine('l-1', 'est-1', '+51 900 000 000', 'coexistence', true, {}),
        },
      ],
    });
    const fixture = TestBed.createComponent(DisconnectLineDialog);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('¿Desconectar +51 900 000 000?');
    expect(host.textContent).toContain('Las conversaciones se conservan.');

    [...host.querySelectorAll('button')]
      .find((b) => b.textContent!.includes('Desconectar'))!
      .click();
    await settle();
    expect(disconnect).toHaveBeenCalledWith('est-1');
    expect(dismiss).toHaveBeenCalledWith(true);
  });
});

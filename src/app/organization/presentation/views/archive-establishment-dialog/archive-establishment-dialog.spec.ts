import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { Establishment } from '../../../domain/model/establishment';
import { ArchiveEstablishmentDialog } from './archive-establishment-dialog';

describe('ArchiveEstablishmentDialog', () => {
  it('O4: says what archiving keeps and archives the establishment', async () => {
    const archive = vi.fn(async () => undefined);
    const dismiss = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        { provide: CurrentEstablishment, useValue: { archive } },
        { provide: MatDialogRef, useValue: { close: dismiss } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: new Establishment('est-2', 'Barranco', '', 'America/Lima', null),
        },
      ],
    });
    const fixture = TestBed.createComponent(ArchiveEstablishmentDialog);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('¿Archivar Barranco?');
    expect(host.textContent).toContain('Sus citas, clientes y conversaciones se conservan.');

    [...host.querySelectorAll('button')].find((b) => b.textContent!.includes('Archivar'))!.click();
    await settle();
    expect(archive).toHaveBeenCalledWith('est-2');
    expect(dismiss).toHaveBeenCalledWith(true);
  });
});

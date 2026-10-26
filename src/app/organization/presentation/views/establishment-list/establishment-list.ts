import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { StateView } from '../../../../shared/presentation/components/state-view/state-view';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { Establishment } from '../../../domain/model/establishment';
import { ArchiveEstablishmentSheet } from '../archive-establishment-sheet/archive-establishment-sheet';
import { EstablishmentDetails } from '../establishment-details/establishment-details';
import { OpenEstablishmentDialog } from '../open-establishment-dialog/open-establishment-dialog';

/**
 * Ajustes › Locales, for the owner (03 §5): every open establishment, each edited in its own row (O7), opening
 * another (O4) and archiving one. Opening and editing wait for an active plan; archiving does not (O6).
 */
@Component({
  selector: 'app-establishment-list',
  imports: [EstablishmentDetails, MatButtonModule, MatIconModule, StateView, TranslatePipe],
  templateUrl: './establishment-list.html',
  styleUrls: ['../section.scss', './establishment-list.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstablishmentList {
  private readonly sheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  protected readonly organization = inject(CurrentOrganization);
  protected readonly establishment = inject(CurrentEstablishment);

  protected readonly canChange = computed(() => this.organization.planActive());
  /** The establishment whose row shows the form. */
  protected readonly editing = signal<string | null>(null);
  /** The establishment saved last, which shows the saved message until another is edited. */
  protected readonly saved = signal<string | null>(null);

  protected edit(target: Establishment): void {
    this.saved.set(null);
    this.editing.set(target.id);
  }

  protected done(target: Establishment): void {
    this.editing.set(null);
    this.saved.set(target.id);
  }

  protected open(): void {
    this.dialog.open(OpenEstablishmentDialog, {
      width: 'min(480px, calc(100vw - 32px))',
      autoFocus: 'first-tabbable',
      ariaLabel: this.translate.instant('organization.settings.openSheet.title'),
    });
  }

  protected archive(target: Establishment): void {
    this.sheet.open(ArchiveEstablishmentSheet, {
      data: target,
      ariaLabel: this.translate.instant('organization.settings.archiveSheet.title', {
        name: target.name,
      }),
    });
  }
}

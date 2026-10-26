import { MatDialogConfig } from '@angular/material/dialog';

/**
 * Every confirmation and short form of the app opens as this dialog over the screen, at any width, never as a sheet
 * from the bottom: as wide as a form needs, inside the screen, scrolling when taller than it.
 */
export const DIALOG_OPTIONS: MatDialogConfig = {
  width: 'min(520px, calc(100vw - 32px))',
  maxWidth: 'none',
  maxHeight: 'calc(100dvh - 32px)',
  autoFocus: 'first-tabbable',
};

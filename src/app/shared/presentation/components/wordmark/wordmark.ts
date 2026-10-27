import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { BrandMark } from '../brand-mark/brand-mark';

/** The app's name with the Takodu mark before it, where a screen names the app (drawer, sign-in, picker). */
@Component({
  selector: 'app-wordmark',
  imports: [BrandMark, TranslatePipe],
  template: `<app-brand-mark [size]="24" />{{ 'app.name' | translate }}`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.02em;
      user-select: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Wordmark {}

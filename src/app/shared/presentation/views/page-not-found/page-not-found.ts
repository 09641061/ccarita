import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-page-not-found',
  imports: [MatButtonModule, RouterLink, TranslatePipe],
  template: `
    <h1>{{ 'pageNotFound.title' | translate }}</h1>
    <a matButton="filled" routerLink="/">{{ 'pageNotFound.back' | translate }}</a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageNotFound {}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationItem } from '../../components/shell/navigation-item';
import { Shell } from '../../components/shell/shell';

/**
 * The routed frame of signed-in screens. Until the session exists (F2), `navigation` comes from
 * the route's data and the establishment, plan and account slots stay empty.
 */
@Component({
  selector: 'app-shell-page',
  imports: [RouterOutlet, Shell],
  template: `<app-shell [navigation]="navigation()"><router-outlet /></app-shell>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellPage {
  readonly navigation = input.required<readonly NavigationItem[]>();
}

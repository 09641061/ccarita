import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { MemberRoleKind, NavigationItem, navigationFor } from './navigation-item';
import { Shell } from './shell';

@Component({
  imports: [Shell],
  template: `<app-shell [navigation]="navigation()"><p id="screen">Pantalla</p></app-shell>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly navigation = input.required<readonly NavigationItem[]>();
}

describe('Shell', () => {
  async function render(role: MemberRoleKind, url = '/agenda') {
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter(
          [{ path: '**', component: Host, data: { navigation: navigationFor(role) } }],
          withComponentInputBinding(),
        ),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    return harness.routeNativeElement as HTMLElement;
  }

  it('shows the screen in the main slot', async () => {
    const host = await render('owner');

    expect(host.querySelector('main #screen')?.textContent).toBe('Pantalla');
  });

  it('puts the same destinations in the bottom bar, with no "Más"', async () => {
    const host = await render('owner');
    const tabs = [...host.querySelectorAll('nav.bar .tab .label')].map((t) => t.textContent);

    expect(tabs).toEqual(['Calendario', 'Bandeja', 'Clientes', 'Equipo']);
    expect(host.querySelector('a[href="/mas"]')).toBeNull();
  });

  it('gives staff three destinations and no team', async () => {
    const host = await render('staff');

    expect(host.querySelector('a[href="/equipo"]')).toBeNull();
    expect(host.querySelectorAll('aside a[mat-list-item]')).toHaveLength(3);
  });

  it('marks the current destination', async () => {
    const host = await render('owner', '/bandeja');

    expect(host.querySelector('nav.bar a[href="/bandeja"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
    expect(host.querySelector('nav.bar a[href="/agenda"]')?.hasAttribute('aria-current')).toBe(
      false,
    );
  });
});

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

  it('puts the daily destinations and "Más" in the bottom bar', async () => {
    const host = await render('owner');
    const tabs = [...host.querySelectorAll('nav.bar .tab .label')].map((t) => t.textContent);

    expect(tabs).toEqual(['Calendario', 'Bandeja', 'Clientes', 'Asistente', 'Más']);
  });

  it('marks the assistant with the brand mark, not an icon', async () => {
    const host = await render('owner');
    const assistant = host.querySelector('nav.bar a[href="/asistente"]');

    expect(assistant?.querySelector('app-brand-mark')).not.toBeNull();
    expect(assistant?.querySelector('mat-icon')).toBeNull();
  });

  it('hides the assistant from staff', async () => {
    const host = await render('staff');

    expect(host.querySelector('a[href="/asistente"]')).toBeNull();
    expect(host.querySelectorAll('aside a[mat-list-item]')).toHaveLength(4);
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

  it('marks the assistant, not Ajustes, on the assistant screens inside Ajustes', async () => {
    const host = await render('owner', '/ajustes/uso');

    expect(host.querySelector('aside a[href="/asistente"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
    expect(host.querySelector('aside a[href="/ajustes"]')?.hasAttribute('aria-current')).toBe(
      false,
    );
  });
});

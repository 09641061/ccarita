import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { settle } from '../../../../testing/settle';
import { SettingsLink } from './settings-link';

@Component({
  imports: [SettingsLink],
  template: `<a appSettingsLink="whatsapp">Conectar</a>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {}

describe('SettingsLink', () => {
  async function render(url: string) {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: Host }])],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    const link = (harness.routeNativeElement as HTMLElement).querySelector('a')!;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    return { harness, link, navigate };
  }

  it('opens the section over the current screen, keeping its query', async () => {
    const { harness, link, navigate } = await render('/clientes?q=ana');
    expect(link.getAttribute('href')).toBe('/clientes?q=ana&ajustes=whatsapp');

    link.click();
    await settle();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/clientes?q=ana&ajustes=whatsapp');
    expect(navigate.mock.calls[0][1]).toEqual({ replaceUrl: false });
  });

  it('replaces the address inside the open center, so back closes it', async () => {
    const { link, navigate } = await render('/agenda?ajustes=asistente');
    link.click();
    expect(navigate.mock.calls[0][1]).toEqual({ replaceUrl: true });
  });
});

import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideSpanish } from '../../../testing/provide-spanish';
import { CurrentEstablishment } from '../application/current-establishment.store';
import { CurrentOrganization } from '../application/current-organization.store';
import { MemberAction, MemberRole, canPerform } from '../domain/model/member-role';
import { settingsRoutes } from './organization.routes';

@Component({ selector: 'app-blank', template: '' })
class Blank {}

describe('settingsRoutes', () => {
  async function navigate(role: MemberRole, url: string) {
    const known = signal<MemberRole | null>(null);
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter([
          {
            path: 'ajustes',
            children: settingsRoutes({
              whatsapp: { component: Blank },
              assistant: { component: Blank },
              usage: { component: Blank },
            }),
          },
          { path: 'sin-permiso', component: Blank },
        ]),
        {
          provide: CurrentOrganization,
          useValue: {
            // The role arrives only once pibble answers, as after reloading the page.
            load: vi.fn(async () => known.set(role)),
            role: known,
            can: (action: MemberAction) => known() !== null && canPerform(known()!, action),
            planActive: computed(() => true),
          },
        },
        {
          provide: CurrentEstablishment,
          useValue: { selected: signal(null), list: { isLoading: signal(false) } },
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return TestBed.inject(Router).url;
  }

  it('opens the owner’s first section once the role is known', async () => {
    expect(await navigate('owner', '/ajustes')).toBe('/ajustes/datos');
  });

  it('opens the hours for managers', async () => {
    expect(await navigate('manager', '/ajustes')).toBe('/ajustes/horario');
  });

  it('03 §5: keeps the details and the line from managers', async () => {
    expect(await navigate('manager', '/ajustes/datos')).toBe('/sin-permiso');
    TestBed.resetTestingModule();
    expect(await navigate('manager', '/ajustes/whatsapp')).toBe('/sin-permiso');
  });

  it('03 §5: opens the assistant and its usage for managers', async () => {
    expect(await navigate('manager', '/ajustes/asistente')).toBe('/ajustes/asistente');
    TestBed.resetTestingModule();
    expect(await navigate('manager', '/ajustes/uso')).toBe('/ajustes/uso');
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RENEWAL_CONTACT } from '../../../../shared/application/renewal-contact';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { JoinedOrganization } from '../../../domain/model/joined-organization';
import { MemberAction, MemberRole, canPerform } from '../../../domain/model/member-role';
import { Organization } from '../../../domain/model/organization';
import { Billing } from './billing';

const UNTIL = new Date('2026-11-06T05:00:00Z');

describe('Billing', () => {
  async function render(role: MemberRole = 'owner', planActive = true) {
    const details = new Organization('org-1', 'Barbería Don Lucho', 'max', UNTIL);
    TestBed.configureTestingModule({
      providers: [
        { provide: RENEWAL_CONTACT, useValue: 'renovaciones@takodu.example' },
        provideSpanish(),
        {
          provide: CurrentOrganization,
          useValue: {
            can: (action: MemberAction) => canPerform(role, action),
            selected: signal(
              new JoinedOrganization('org-1', 'Barbería Don Lucho', UNTIL, 'm-1', 'owner'),
            ),
            planActive: signal(planActive),
            planActiveUntil: signal(UNTIL),
            details: { hasValue: () => true, value: () => details },
          },
        },
        { provide: CurrentEstablishment, useValue: { timeZone: signal('America/Lima') } },
      ],
    });
    const fixture = TestBed.createComponent(Billing);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');

  it('O5: shows the plan, its end in Lima, and how to renew', async () => {
    const host = await render();
    expect(text(host)).toContain('Plan Max');
    expect(text(host)).toContain('Activo hasta el 6 nov. 2026');
    expect(host.querySelector('a')!.getAttribute('href')).toBe(
      'mailto:renovaciones@takodu.example',
    );
    expect(text(host)).toContain('Yape');
  });

  it('O6: marks an ended plan', async () => {
    const host = await render('owner', false);
    expect(text(host)).toContain('Vencido');
    expect(text(host)).toContain('Terminó el 6 nov. 2026');
  });

  it('03 §5: is the owner’s', async () => {
    const host = await render('manager');
    expect(text(host)).toContain('no está disponible para tu rol');
  });
});

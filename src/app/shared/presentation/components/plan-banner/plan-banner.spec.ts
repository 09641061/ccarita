import { TestBed } from '@angular/core/testing';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { PlanBanner } from './plan-banner';

describe('PlanBanner', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideSpanish()] }));

  it('says when the plan ended, in the establishment time zone, and how to renew', async () => {
    const fixture = TestBed.createComponent(PlanBanner);
    // 03:00 UTC on 7 Nov is still 6 Nov in Lima.
    fixture.componentRef.setInput('endedOn', new Date('2026-11-07T03:00:00Z'));
    fixture.componentRef.setInput('timeZone', 'America/Lima');
    fixture.componentRef.setInput('renewalContact', 'renovaciones@takodu.example');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.getAttribute('role')).toBe('status');
    expect(element.querySelector('h2')?.textContent).toContain('Tu plan terminó el 6 nov. 2026');
    expect(element.textContent).toContain('Asistente y recordatorios detenidos');
    expect(element.textContent).toContain('renovaciones@takodu.example');
  });
});

import { TestBed } from '@angular/core/testing';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { AppointmentStatusKind, StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideSpanish()] }));

  async function render(status: AppointmentStatusKind) {
    const fixture = TestBed.createComponent(StatusBadge);
    fixture.componentRef.setInput('status', status);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it.each([
    ['confirmed', 'check', 'Confirmada'],
    ['in_progress', 'play_arrow', 'En curso'],
    ['completed', 'check_circle', 'Completada'],
    ['cancelled', 'close', 'Cancelada'],
    ['no_show', 'person_off', 'No asistió'],
  ] as const)('shows %s with an icon and its text', async (status, icon, text) => {
    const badge = await render(status);

    expect(badge.querySelector('mat-icon')?.textContent).toBe(icon);
    expect(badge.textContent).toContain(text);
    expect(badge.classList).toContain(status);
  });
});

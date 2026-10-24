import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BusyButton } from './busy-button';

@Component({
  imports: [BusyButton],
  template: `<app-busy-button [busy]="busy()" (pressed)="presses = presses + 1">{{
    busy() ? 'Reservando…' : 'Reservar'
  }}</app-busy-button>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly busy = signal(false);
  presses = 0;
}

describe('BusyButton', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return fixture;
  }

  it('emits pressed while idle', async () => {
    const fixture = await render();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    button.click();

    expect(fixture.componentInstance.presses).toBe(1);
    expect(button.hasAttribute('aria-busy')).toBe(false);
  });

  it('blocks a second press and shows progress while busy', async () => {
    const fixture = await render();
    fixture.componentInstance.busy.set(true);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    button.click();

    expect(fixture.componentInstance.presses).toBe(0);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('mat-progress-spinner')).not.toBeNull();
    expect(button.textContent).toContain('Reservando…');
  });
});

import { TestBed } from '@angular/core/testing';
import { Avatar } from './avatar';

describe('Avatar', () => {
  async function render(name: string, colorIndex = 0) {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('name', name);
    fixture.componentRef.setInput('colorIndex', colorIndex);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the initials of the first two words', async () => {
    expect((await render('luis ramírez soto')).textContent).toBe('LR');
    expect((await render('  Ñaño ')).textContent).toBe('Ñ');
  });

  it('cycles through the four member colors', async () => {
    expect((await render('Kevin', 5)).style.getPropertyValue('--avatar-bg')).toBe(
      'var(--tk-member-2)',
    );
    expect((await render('Kevin', 3)).style.getPropertyValue('--avatar-fg')).toBe(
      'var(--tk-member-4-fg)',
    );
  });

  it('is hidden from assistive technology', async () => {
    expect((await render('Rosa')).getAttribute('aria-hidden')).toBe('true');
  });
});

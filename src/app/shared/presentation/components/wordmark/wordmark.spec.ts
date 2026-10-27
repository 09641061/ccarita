import { TestBed } from '@angular/core/testing';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { Wordmark } from './wordmark';

describe('Wordmark', () => {
  it('shows the Takodu mark before the app name, as decoration', async () => {
    TestBed.configureTestingModule({ providers: [provideSpanish()] });
    const fixture = TestBed.createComponent(Wordmark);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent?.trim()).toBe('Takodu');
    expect(host.querySelector('img')?.getAttribute('aria-hidden')).toBe('true');
  });
});

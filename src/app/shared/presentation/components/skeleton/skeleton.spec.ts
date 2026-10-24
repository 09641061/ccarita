import { TestBed } from '@angular/core/testing';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideSpanish()] }));

  it('announces loading and draws the requested rows', async () => {
    const fixture = TestBed.createComponent(Skeleton);
    fixture.componentRef.setInput('rows', 5);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.getAttribute('aria-busy')).toBe('true');
    expect(element.textContent).toContain('Cargando');
    expect(element.querySelectorAll('.row')).toHaveLength(5);
  });
});

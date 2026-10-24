import { TestBed } from '@angular/core/testing';
import { BrandMark } from './brand-mark';

describe('BrandMark', () => {
  function render(inputs: { size?: number; label?: string }) {
    const fixture = TestBed.createComponent(BrandMark);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('img') as HTMLImageElement;
  }

  it('is decorative without a label', () => {
    const img = render({});

    expect(img.getAttribute('src')).toBe('brand/takodu.svg');
    expect(img.alt).toBe('');
    expect(img.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps the proportions of the mark and announces its label', () => {
    const img = render({ size: 64, label: 'Tako' });

    expect(img.width).toBe(64);
    expect(img.height).toBe(59);
    expect(img.alt).toBe('Tako');
    expect(img.hasAttribute('aria-hidden')).toBe(false);
  });
});
